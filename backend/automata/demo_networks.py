"""
Demo Networks Loader and Curated Test Suite.
Implements Upgrade 3: Automated Test-Network Generator.
Loads demo network fixtures (Linear, Branching, Dead-End, Disconnected, Train-Restricted, Multiple-Routes),
builds RailwayAutomaton instances, and executes verification test suites.
"""

import os
import json
from typing import Dict, List, Any, Optional
from .railway_automaton import RailwayAutomaton

FIXTURES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "fixtures"))


def load_all_fixtures() -> List[Dict[str, Any]]:
    """Load all JSON fixture files from FIXTURES_DIR sorted by id."""
    fixtures = []
    if not os.path.exists(FIXTURES_DIR):
        return fixtures

    # Fixed ordering for A -> F
    order = ["linear", "branching", "dead-end", "disconnected", "train-restrictions", "multiple-routes"]
    file_map = {}
    for filename in os.listdir(FIXTURES_DIR):
        if filename.endswith(".json"):
            filepath = os.path.join(FIXTURES_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    file_map[data.get("id")] = data
            except Exception as e:
                print(f"Error loading fixture {filename}: {e}")

    for fix_id in order:
        if fix_id in file_map:
            fixtures.append(file_map[fix_id])

    # Append any remaining fixtures
    for fix_id, data in file_map.items():
        if fix_id not in order:
            fixtures.append(data)

    return fixtures


def get_fixture_by_id(fixture_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve fixture by ID."""
    fixtures = load_all_fixtures()
    for f in fixtures:
        if f.get("id") == fixture_id:
            return f
    return None


def fixture_to_automaton(fixture: Dict[str, Any]) -> RailwayAutomaton:
    """
    Convert a fixture dictionary into a RailwayAutomaton instance.
    Supports fixture transition schema: {"from": "A", "to": "B", "train_types": [...]}
    as well as standard edges {"source": ..., "target": ..., "train_type": ...}.
    """
    auto = RailwayAutomaton(name=fixture.get("name", "Demo Network"))
    stations = fixture.get("stations", [])
    start_station = fixture.get("start_station")
    accepting_stations = set(fixture.get("accepting_stations", []))
    meta = fixture.get("station_metadata", {})

    for s in stations:
        is_start = (s == start_station)
        is_acc = (s in accepting_stations)
        s_meta = meta.get(s, {})
        auto.add_station(s, is_start=is_start, is_accepting=is_acc, **s_meta)

    auto.set_start_station(start_station)
    auto.set_accepting_stations(list(accepting_stations))

    transitions = fixture.get("transitions", [])
    for t in transitions:
        # Check fixture format
        src = t.get("from") or t.get("source")
        dest = t.get("to") or t.get("target")
        types = t.get("train_types")
        if not types and "train_type" in t:
            types = [t.get("train_type")]
        if src and dest and types:
            auto.add_transition(src, dest, types)

    return auto


def run_curated_tests() -> Dict[str, Any]:
    """
    Execute curated application-level test suite against all demo networks.
    Safe for in-app execution (no shell execution).
    """
    fixtures = load_all_fixtures()
    test_results = []
    total_passed = 0
    total_tests = 0

    for fix in fixtures:
        fix_id = fix.get("id")
        net = fixture_to_automaton(fix)
        expected = fix.get("expected_outcomes", {})

        # Test A: Linear network
        if fix_id == "linear":
            total_tests += 1
            res = net.validate_route(["A", "B", "C", "D"], "Express")
            passed = res.get("accepted") is True
            if passed: total_passed += 1
            test_results.append({
                "scenario": fix.get("scenario", fix.get("name")),
                "network_id": fix_id,
                "test_name": "Valid Linear Route Acceptance",
                "input": "Express route [A, B, C, D]",
                "expected": "Accepted (True)",
                "actual": f"Accepted: {res.get('accepted')}",
                "passed": passed,
                "details": res.get("reason")
            })

            total_tests += 1
            sp = net.find_shortest_path("A", "D", "Express")
            sp_passed = sp.get("hops") == 3 and sp.get("path") == ["A", "B", "C", "D"]
            if sp_passed: total_passed += 1
            test_results.append({
                "scenario": fix.get("scenario", fix.get("name")),
                "network_id": fix_id,
                "test_name": "Linear BFS Shortest Path",
                "input": "Source: A, Dest: D, Train: Express",
                "expected": "3 hops (A -> B -> C -> D)",
                "actual": f"{sp.get('hops')} hops ({' -> '.join(sp.get('path', []))})",
                "passed": sp_passed,
                "details": sp.get("message")
            })

        # Test B: Branching network
        elif fix_id == "branching":
            total_tests += 1
            sp = net.find_shortest_path("A", "D", "Express")
            sp_passed = sp.get("hops") == 2 and sp.get("path") in [["A", "B", "D"], ["A", "C", "D"]]
            if sp_passed: total_passed += 1
            test_results.append({
                "scenario": fix.get("scenario", fix.get("name")),
                "network_id": fix_id,
                "test_name": "BFS Minimum-Hop Route across Branches",
                "input": "Source: A, Dest: D, Train: Express",
                "expected": "2 hops (A -> B -> D or A -> C -> D)",
                "actual": f"{sp.get('hops')} hops ({' -> '.join(sp.get('path', []))})",
                "passed": sp_passed,
                "details": sp.get("message")
            })

        # Test C: Dead-end network
        elif fix_id == "dead-end":
            total_tests += 1
            dead_ends = net.find_dead_ends("Express")
            de_passed = ("E" in dead_ends) and ("D" not in dead_ends)
            if de_passed: total_passed += 1
            test_results.append({
                "scenario": fix.get("scenario", fix.get("name")),
                "network_id": fix_id,
                "test_name": "Dead-End Detection (E flagged, D not flagged)",
                "input": "find_dead_ends('Express')",
                "expected": "Dead ends: ['E']; Accepting 'D' excluded",
                "actual": f"Dead ends: {dead_ends}",
                "passed": de_passed,
                "details": "Non-accepting station with no outgoing track flagged; terminal accepting station excluded."
            })

        # Test D: Disconnected network
        elif fix_id == "disconnected":
            total_tests += 1
            cons = net.check_network_consistency("Express")
            unreach = cons.get("unreachable_from_start", [])
            disc_passed = "X" in unreach and "Y" in unreach and not cons.get("is_consistent")
            if disc_passed: total_passed += 1
            test_results.append({
                "scenario": fix.get("scenario", fix.get("name")),
                "network_id": fix_id,
                "test_name": "Reachability & Consistency Audit",
                "input": "check_network_consistency('Express') from start A",
                "expected": "Unreachable: ['X', 'Y'], Consistent: False",
                "actual": f"Unreachable: {unreach}, Consistent: {cons.get('is_consistent')}",
                "passed": disc_passed,
                "details": "; ".join(cons.get("warnings", []))
            })

        # Test E: Train restrictions
        elif fix_id == "train-restrictions":
            total_tests += 1
            exp_res = net.validate_route(["A", "B", "C", "D"], "Express")
            loc_res = net.validate_route(["A", "B", "C", "D"], "Local")
            restr_passed = (
                exp_res.get("accepted") is True and
                loc_res.get("accepted") is False and
                loc_res.get("failure_station") == "B"
            )
            if restr_passed: total_passed += 1
            test_results.append({
                "scenario": fix.get("scenario", fix.get("name")),
                "network_id": fix_id,
                "test_name": "Train Restriction Filtering",
                "input": "Route [A, B, C, D] on Express vs Local",
                "expected": "Express: Accepted; Local: Rejected at B",
                "actual": f"Express: {exp_res.get('accepted')}; Local: {loc_res.get('accepted')} (Failed at {loc_res.get('failure_station')})",
                "passed": restr_passed,
                "details": loc_res.get("reason")
            })

        # Test F: Multiple routes
        elif fix_id == "multiple-routes":
            total_tests += 1
            sp_exp = net.find_shortest_path("A", "D", "Express")
            sp_loc = net.find_shortest_path("A", "D", "Local")
            mult_passed = (
                sp_exp.get("hops") == 2 and sp_exp.get("path") == ["A", "Fast_Hub", "D"] and
                sp_loc.get("hops") == 3 and sp_loc.get("path") == ["A", "B", "C", "D"]
            )
            if mult_passed: total_passed += 1
            test_results.append({
                "scenario": fix.get("scenario", fix.get("name")),
                "network_id": fix_id,
                "test_name": "BFS Multi-Route Optimal Selection",
                "input": "Shortest path A -> D under Express vs Local",
                "expected": "Express: 2 hops (A -> Fast_Hub -> D); Local: 3 hops (A -> B -> C -> D)",
                "actual": f"Express: {sp_exp.get('hops')} hops; Local: {sp_loc.get('hops')} hops",
                "passed": mult_passed,
                "details": f"Express route: {' -> '.join(sp_exp.get('path', []))}; Local route: {' -> '.join(sp_loc.get('path', []))}"
            })

    return {
        "total_scenarios": len(fixtures),
        "total_tests": total_tests,
        "total_passed": total_passed,
        "total_failed": total_tests - total_passed,
        "all_passed": (total_passed == total_tests),
        "results": test_results
    }
