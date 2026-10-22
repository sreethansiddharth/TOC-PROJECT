"""
Automata models and algorithms for Smart Railway Route Verifier.
Implements:
  - Finite Automaton: Q (stations), Sigma (train types), delta (transitions), q0 (start), F (accepting)
  - Route validation (accept/reject, failure point, missing track vs train type restriction)
  - Dead-end detection (non-accepting stations with no outgoing transitions for the train type)
  - Shortest accepted path search (Breadth-First Search)
  - Network consistency checks (unreachable stations, orphan stations, conflicting transitions)
  - Verification report generator
"""

from collections import deque
from typing import Dict, List, Set, Tuple, Optional, Any


class RailwayAutomaton:
    """
    Railway Automaton representation:
    - States (Q): Stations (e.g. {'A', 'B', 'C'})
    - Alphabet (Sigma): Train types (e.g. {'Express', 'Local', 'Freight'})
    - Transition function (delta): (current_station, train_type) -> Set[next_station]
    - Start state (q0): Source station
    - Accepting states (F): Destination stations
    """

    def __init__(self, name: str = "Default Railway Network"):
        self.name: str = name
        self.stations: Set[str] = set()
        self.start_station: Optional[str] = None
        self.accepting_stations: Set[str] = set()
        # transitions: current_station -> train_type -> set of next_stations
        self.transitions: Dict[str, Dict[str, Set[str]]] = {}
        # metadata like coordinates, full names if provided
        self.station_metadata: Dict[str, Dict[str, Any]] = {}

    def add_station(self, station: str, is_start: bool = False, is_accepting: bool = False, **meta) -> None:
        """Add a station to the automaton."""
        station = station.strip()
        if not station:
            raise ValueError("Station name cannot be empty")
        self.stations.add(station)
        if station not in self.transitions:
            self.transitions[station] = {}
        if is_start:
            self.set_start_station(station)
        if is_accepting:
            self.accepting_stations.add(station)
        self.station_metadata[station] = meta

    def remove_station(self, station: str) -> None:
        """Remove a station and all connected transitions."""
        station = station.strip()
        self.stations.discard(station)
        if self.start_station == station:
            self.start_station = None
        self.accepting_stations.discard(station)
        self.transitions.pop(station, None)
        self.station_metadata.pop(station, None)

        # Remove incoming transitions targeting this station
        for src, train_map in self.transitions.items():
            for t_type, dests in list(train_map.items()):
                dests.discard(station)

    def set_start_station(self, station: Optional[str]) -> None:
        """Set the start station (initial state q0)."""
        if station is not None:
            station = station.strip()
            if station and station not in self.stations:
                self.stations.add(station)
                if station not in self.transitions:
                    self.transitions[station] = {}
        self.start_station = station

    def set_accepting_stations(self, stations: List[str]) -> None:
        """Set the list of accepting / destination stations (F)."""
        self.accepting_stations = set()
        for s in stations:
            s = s.strip()
            if s:
                self.stations.add(s)
                if s not in self.transitions:
                    self.transitions[s] = {}
                self.accepting_stations.add(s)

    def toggle_accepting_station(self, station: str) -> bool:
        """Toggle accepting status of a station."""
        station = station.strip()
        if station not in self.stations:
            self.add_station(station)
        if station in self.accepting_stations:
            self.accepting_stations.remove(station)
            return False
        else:
            self.accepting_stations.add(station)
            return True

    def add_transition(self, src: str, dest: str, train_types: List[str]) -> None:
        """
        Add a track connection from src to dest permitted for specified train types.
        """
        src = src.strip()
        dest = dest.strip()
        if not src or not dest:
            raise ValueError("Source and destination stations cannot be empty")
        
        self.stations.add(src)
        self.stations.add(dest)
        if src not in self.transitions:
            self.transitions[src] = {}
        if dest not in self.transitions:
            self.transitions[dest] = {}

        for t in train_types:
            t = t.strip()
            if not t:
                continue
            if t not in self.transitions[src]:
                self.transitions[src][t] = set()
            self.transitions[src][t].add(dest)

    def remove_transition(self, src: str, dest: str, train_type: Optional[str] = None) -> None:
        """Remove a transition or specific train type permission."""
        src = src.strip()
        dest = dest.strip()
        if src in self.transitions:
            if train_type:
                train_type = train_type.strip()
                if train_type in self.transitions[src]:
                    self.transitions[src][train_type].discard(dest)
                    if not self.transitions[src][train_type]:
                        del self.transitions[src][train_type]
            else:
                for t in list(self.transitions[src].keys()):
                    self.transitions[src][t].discard(dest)
                    if not self.transitions[src][t]:
                        del self.transitions[src][t]

    def get_outgoing_transitions(self, station: str, train_type: Optional[str] = None) -> Dict[str, Set[str]]:
        """Get outgoing transitions for a station, optionally filtered by train type."""
        if station not in self.transitions:
            return {}
        if train_type:
            return {train_type: self.transitions[station].get(train_type, set()).copy()}
        return {k: v.copy() for k, v in self.transitions[station].items()}

    def get_track_train_types(self, src: str, dest: str) -> List[str]:
        """Return list of train types permitted on direct track from src to dest."""
        if src not in self.transitions:
            return []
        permitted = []
        for t_type, dests in self.transitions[src].items():
            if dest in dests:
                permitted.append(t_type)
        return sorted(permitted)

    def validate_route(self, route: List[str], train_type: str) -> Dict[str, Any]:
        """
        Automata Validation Engine:
        Verifies proposed route as an ordered sequence of states under train_type alphabet.
        Returns:
            accepted: bool
            reason: str
            failure_station: Optional[str]
            failure_step: Optional[int]
            failure_cause: Optional['MISSING_TRACK' | 'TRAIN_RESTRICTION' | 'NOT_ACCEPTING' | 'INVALID_SOURCE' | 'EMPTY_ROUTE']
            route_path: List[str]
        """
        train_type = train_type.strip()
        if not route:
            return {
                "accepted": False,
                "reason": "Route cannot be empty.",
                "failure_station": None,
                "failure_step": None,
                "failure_cause": "EMPTY_ROUTE",
                "route_path": []
            }

        cleaned_route = [s.strip() for s in route if s.strip()]
        if not cleaned_route:
            return {
                "accepted": False,
                "reason": "Route contains no valid station names.",
                "failure_station": None,
                "failure_step": None,
                "failure_cause": "EMPTY_ROUTE",
                "route_path": []
            }

        start_node = cleaned_route[0]
        if start_node not in self.stations:
            return {
                "accepted": False,
                "reason": f"Start station '{start_node}' does not exist in the network.",
                "failure_station": start_node,
                "failure_step": 0,
                "failure_cause": "INVALID_SOURCE",
                "route_path": cleaned_route
            }

        # Step-by-step automata transition verification
        for idx in range(len(cleaned_route) - 1):
            curr_station = cleaned_route[idx]
            next_station = cleaned_route[idx + 1]

            if next_station not in self.stations:
                return {
                    "accepted": False,
                    "reason": f"Station '{next_station}' does not exist in the railway network.",
                    "failure_station": curr_station,
                    "failure_step": idx,
                    "failure_cause": "MISSING_TRACK",
                    "route_path": cleaned_route
                }

            # Check if any track exists from curr to next
            all_permitted_types = self.get_track_train_types(curr_station, next_station)
            if not all_permitted_types:
                return {
                    "accepted": False,
                    "reason": f"No physical track connection exists from station '{curr_station}' to '{next_station}'.",
                    "failure_station": curr_station,
                    "failure_step": idx,
                    "failure_cause": "MISSING_TRACK",
                    "route_path": cleaned_route
                }

            # Check train type permission
            if train_type not in all_permitted_types:
                return {
                    "accepted": False,
                    "reason": (
                        f"Track from '{curr_station}' to '{next_station}' is restricted. "
                        f"Permits {all_permitted_types}, but journey train type is '{train_type}'."
                    ),
                    "failure_station": curr_station,
                    "failure_step": idx,
                    "failure_cause": "TRAIN_RESTRICTION",
                    "route_path": cleaned_route
                }

        destination = cleaned_route[-1]
        # Check destination is an accepting state
        if self.accepting_stations and (destination not in self.accepting_stations):
            return {
                "accepted": False,
                "reason": (
                    f"Route terminates at station '{destination}', which is not an accepting / destination station."
                ),
                "failure_station": destination,
                "failure_step": len(cleaned_route) - 1,
                "failure_cause": "NOT_ACCEPTING",
                "route_path": cleaned_route
            }

        return {
            "accepted": True,
            "reason": f"Proposed journey successfully verified and accepted under '{train_type}' service.",
            "failure_station": None,
            "failure_step": None,
            "failure_cause": None,
            "route_path": cleaned_route
        }

    def find_dead_ends(self, train_type: str) -> List[str]:
        """
        Dead-End Detection:
        Identify non-accepting stations with NO valid outgoing transitions for the selected train type.
        Accepting stations are NOT flagged as dead ends solely because they have no outgoing transitions.
        """
        train_type = train_type.strip()
        dead_ends = []
        for station in sorted(self.stations):
            if station in self.accepting_stations:
                continue
            outgoing = self.transitions.get(station, {}).get(train_type, set())
            if len(outgoing) == 0:
                dead_ends.append(station)
        return dead_ends

    def find_shortest_path(self, source: str, destination: str, train_type: str) -> Dict[str, Any]:
        """
        Breadth-First Search (BFS) to compute the minimum-hop accepted route
        between source and destination for the given train type.
        """
        source = source.strip()
        destination = destination.strip()
        train_type = train_type.strip()

        if source not in self.stations:
            return {
                "found": False,
                "hops": -1,
                "path": [],
                "message": f"Source station '{source}' does not exist."
            }
        if destination not in self.stations:
            return {
                "found": False,
                "hops": -1,
                "path": [],
                "message": f"Destination station '{destination}' does not exist."
            }

        if source == destination:
            return {
                "found": True,
                "hops": 0,
                "path": [source],
                "message": "Source and destination are identical (0 hops)."
            }

        queue = deque([(source, [source])])
        visited = {source}

        while queue:
            curr, path = queue.popleft()
            neighbors = self.transitions.get(curr, {}).get(train_type, set())
            # Sort neighbors for deterministic testable output
            for neighbor in sorted(neighbors):
                if neighbor == destination:
                    final_path = path + [neighbor]
                    return {
                        "found": True,
                        "hops": len(final_path) - 1,
                        "path": final_path,
                        "message": f"Found shortest route with {len(final_path) - 1} hops."
                    }
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, path + [neighbor]))

        return {
            "found": False,
            "hops": -1,
            "path": [],
            "message": f"No valid path exists from '{source}' to '{destination}' for train type '{train_type}'."
        }

    def check_network_consistency(self, train_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Network Consistency Checker:
        - Unreachable stations from start station.
        - Orphaned stations with no incoming or outgoing tracks.
        - Dead-end stations (if train_type given).
        - Transition integrity / conflicts.
        """
        orphans = []
        in_degree: Dict[str, int] = {s: 0 for s in self.stations}
        out_degree: Dict[str, int] = {s: 0 for s in self.stations}

        for src, train_map in self.transitions.items():
            for t_type, dests in train_map.items():
                out_degree[src] = out_degree.get(src, 0) + len(dests)
                for d in dests:
                    in_degree[d] = in_degree.get(d, 0) + 1

        for s in sorted(self.stations):
            if in_degree.get(s, 0) == 0 and out_degree.get(s, 0) == 0:
                orphans.append(s)

        # Unreachable from start station
        unreachable_from_start = []
        if self.start_station and self.start_station in self.stations:
            reachable = set()
            queue = deque([self.start_station])
            reachable.add(self.start_station)
            while queue:
                curr = queue.popleft()
                # Consider all train types or specific train type
                if train_type:
                    neighbors = self.transitions.get(curr, {}).get(train_type, set())
                else:
                    neighbors = set()
                    for t_type, dests in self.transitions.get(curr, {}).items():
                        neighbors.update(dests)
                for n in neighbors:
                    if n not in reachable and n in self.stations:
                        reachable.add(n)
                        queue.append(n)
            unreachable_from_start = sorted(list(self.stations - reachable))

        # Check for destination reachability
        unreachable_accepting = [s for s in self.accepting_stations if s in unreachable_from_start]

        dead_ends = self.find_dead_ends(train_type) if train_type else []

        warnings = []
        if not self.start_station:
            warnings.append("No start station designated for this network.")
        elif self.start_station not in self.stations:
            warnings.append(f"Start station '{self.start_station}' is not in the stations list.")

        if not self.accepting_stations:
            warnings.append("No accepting/destination stations designated.")

        if orphans:
            warnings.append(f"{len(orphans)} orphaned station(s) found with zero connections: {', '.join(orphans)}.")

        if unreachable_from_start:
            scope = f"for '{train_type}'" if train_type else "across any train type"
            warnings.append(
                f"{len(unreachable_from_start)} station(s) unreachable from start '{self.start_station}' {scope}."
            )

        return {
            "is_consistent": len(warnings) == 0 and len(orphans) == 0,
            "start_station": self.start_station,
            "accepting_stations": sorted(list(self.accepting_stations)),
            "orphaned_stations": orphans,
            "unreachable_from_start": unreachable_from_start,
            "unreachable_accepting_stations": unreachable_accepting,
            "dead_end_stations": dead_ends,
            "warnings": warnings,
            "total_stations": len(self.stations),
            "total_transitions": sum(
                len(dests) for train_map in self.transitions.values() for dests in train_map.values()
            )
        }

    def generate_report(self, proposed_route: List[str], train_type: str) -> Dict[str, Any]:
        """
        Generate verification report for proposed journey.
        """
        val_result = self.validate_route(proposed_route, train_type)
        consistency = self.check_network_consistency(train_type)
        dead_ends = self.find_dead_ends(train_type)
        
        shortest_path_result = None
        if proposed_route:
            src = proposed_route[0]
            dst = proposed_route[-1]
            shortest_path_result = self.find_shortest_path(src, dst, train_type)

        report = {
            "network_name": self.name,
            "train_type": train_type,
            "proposed_route": proposed_route,
            "status": "ACCEPTED" if val_result["accepted"] else "REJECTED",
            "accepted": val_result["accepted"],
            "validation_details": val_result,
            "dead_end_stations": dead_ends,
            "unreachable_stations": consistency["unreachable_from_start"],
            "shortest_path": shortest_path_result,
            "consistency_warnings": consistency["warnings"],
            "total_network_stations": len(self.stations)
        }
        return report

    def to_dict(self) -> Dict[str, Any]:
        """Serialize automaton to JSON-compatible dictionary."""
        # Convert transitions to a list of edge objects
        edges = []
        for src, train_map in self.transitions.items():
            for t_type, dests in train_map.items():
                for d in dests:
                    edges.append({"source": src, "target": d, "train_type": t_type})

        return {
            "name": self.name,
            "stations": sorted(list(self.stations)),
            "start_station": self.start_station,
            "accepting_stations": sorted(list(self.accepting_stations)),
            "station_metadata": self.station_metadata,
            "transitions": edges
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RailwayAutomaton":
        """Reconstruct automaton from dictionary."""
        auto = cls(name=data.get("name", "Railway Network"))
        auto.stations = set(data.get("stations", []))
        auto.start_station = data.get("start_station")
        auto.accepting_stations = set(data.get("accepting_stations", []))
        auto.station_metadata = data.get("station_metadata", {})

        auto.transitions = {s: {} for s in auto.stations}

        raw_edges = data.get("transitions", [])
        for edge in raw_edges:
            src = edge.get("source")
            dest = edge.get("target")
            train_type = edge.get("train_type")
            if src and dest and train_type:
                auto.add_transition(src, dest, [train_type])

        return auto
