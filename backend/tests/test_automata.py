import pytest
from backend.automata.railway_automaton import RailwayAutomaton


def test_proposal_example_scenario():
    """
    Scenario from Section 5.3 of Requirements:
    Express: A -> B -> C -> D
    Local:   A -> B -> E
    Expected:
    - Express route [A, B, C, D] is accepted.
    - Local route [A, B, C, D] is rejected at B because no Local transition from B to C exists.
    - Failure station identified as B.
    """
    net = RailwayAutomaton(name="Proposal Example Network")
    net.set_start_station("A")
    net.set_accepting_stations(["D", "E"])

    net.add_transition("A", "B", ["Express", "Local"])
    net.add_transition("B", "C", ["Express"])
    net.add_transition("C", "D", ["Express"])
    net.add_transition("B", "E", ["Local"])

    # 1. Express route A -> B -> C -> D
    express_res = net.validate_route(["A", "B", "C", "D"], train_type="Express")
    assert express_res["accepted"] is True
    assert express_res["failure_station"] is None

    # 2. Local train on A -> B -> C -> D
    local_res = net.validate_route(["A", "B", "C", "D"], train_type="Local")
    assert local_res["accepted"] is False
    assert local_res["failure_station"] == "B"
    assert local_res["failure_cause"] == "TRAIN_RESTRICTION"

    # 3. Local route A -> B -> E
    local_valid = net.validate_route(["A", "B", "E"], train_type="Local")
    assert local_valid["accepted"] is True


def test_missing_transition():
    """Route rejected because track connection does not exist."""
    net = RailwayAutomaton()
    net.set_start_station("A")
    net.set_accepting_stations(["C"])
    net.add_transition("A", "B", ["Express"])
    # No transition from B to C

    res = net.validate_route(["A", "B", "C"], train_type="Express")
    assert res["accepted"] is False
    assert res["failure_station"] == "B"
    assert res["failure_cause"] == "MISSING_TRACK"


def test_destination_not_accepting():
    """Route traverses valid tracks but ends at non-accepting station."""
    net = RailwayAutomaton()
    net.set_start_station("A")
    net.set_accepting_stations(["D"])
    net.add_transition("A", "B", ["Express"])
    net.add_transition("B", "C", ["Express"])

    res = net.validate_route(["A", "B", "C"], train_type="Express")
    assert res["accepted"] is False
    assert res["failure_station"] == "C"
    assert res["failure_cause"] == "NOT_ACCEPTING"


def test_dead_end_detection():
    """
    Section 4.4:
    Detect non-accepting stations with no outgoing transitions for the selected train type.
    Avoid flagging accepting stations as dead ends.
    """
    net = RailwayAutomaton()
    net.add_station("A")
    net.add_station("B")
    net.add_station("C_DeadEnd")
    net.add_station("D_TerminalAccepting", is_accepting=True)

    net.add_transition("A", "B", ["Express", "Local"])
    net.add_transition("B", "C_DeadEnd", ["Local"])
    net.add_transition("B", "D_TerminalAccepting", ["Express"])

    # For Local train:
    # C_DeadEnd has no outgoing transitions and is non-accepting -> dead end!
    # D_TerminalAccepting has no outgoing transitions, BUT is accepting -> NOT a dead end!
    dead_ends_local = net.find_dead_ends("Local")
    assert "C_DeadEnd" in dead_ends_local
    assert "D_TerminalAccepting" not in dead_ends_local

    # For Express train:
    # C_DeadEnd has no outgoing transitions -> dead end for Express too
    dead_ends_express = net.find_dead_ends("Express")
    assert "C_DeadEnd" in dead_ends_express
    assert "D_TerminalAccepting" not in dead_ends_express


def test_shortest_path_bfs():
    """
    Section 4.5:
    BFS shortest path finder considering train-type permissions.
    """
    net = RailwayAutomaton()
    # Path 1: A -> B -> C -> D (3 hops, Freight only)
    # Path 2: A -> E -> D (2 hops, Express only)
    net.add_transition("A", "B", ["Freight"])
    net.add_transition("B", "C", ["Freight"])
    net.add_transition("C", "D", ["Freight"])

    net.add_transition("A", "E", ["Express"])
    net.add_transition("E", "D", ["Express"])

    # Express BFS shortest path
    res_express = net.find_shortest_path("A", "D", "Express")
    assert res_express["found"] is True
    assert res_express["hops"] == 2
    assert res_express["path"] == ["A", "E", "D"]

    # Freight BFS shortest path
    res_freight = net.find_shortest_path("A", "D", "Freight")
    assert res_freight["found"] is True
    assert res_freight["hops"] == 3
    assert res_freight["path"] == ["A", "B", "C", "D"]

    # Local has no path
    res_local = net.find_shortest_path("A", "D", "Local")
    assert res_local["found"] is False
    assert res_local["hops"] == -1
    assert res_local["path"] == []


def test_network_consistency():
    """
    Section 4.6:
    Unreachable stations from start, orphaned stations, structural consistency.
    """
    net = RailwayAutomaton()
    net.set_start_station("A")
    net.set_accepting_stations(["B", "X_UnreachableDest"])

    net.add_station("Orphan")
    net.add_transition("A", "B", ["Express"])
    net.add_transition("C_Isolated", "X_UnreachableDest", ["Express"])

    report = net.check_network_consistency(train_type="Express")
    assert report["is_consistent"] is False
    assert "Orphan" in report["orphaned_stations"]
    assert "C_Isolated" in report["unreachable_from_start"]
    assert "X_UnreachableDest" in report["unreachable_from_start"]
    assert "X_UnreachableDest" in report["unreachable_accepting_stations"]


def test_edge_cases():
    """
    Edge cases specified in Section 10:
    - empty route
    - unknown source/destination
    - source equal to destination
    - station removal with transitions
    """
    net = RailwayAutomaton()
    net.add_station("A", is_start=True, is_accepting=True)
    net.add_station("B")
    net.add_transition("A", "B", ["Local"])

    # Empty route
    assert net.validate_route([], "Local")["accepted"] is False

    # Unknown source
    assert net.validate_route(["GhostStation", "B"], "Local")["accepted"] is False

    # Source == Destination (valid 0 hop)
    res_same = net.find_shortest_path("A", "A", "Local")
    assert res_same["found"] is True
    assert res_same["hops"] == 0

    # Station removal
    net.remove_station("B")
    assert "B" not in net.stations
    assert net.get_outgoing_transitions("A", "Local") == {"Local": set()}


def test_serialization():
    """Check to_dict and from_dict roundtrip."""
    net = RailwayAutomaton(name="Serialization Test")
    net.add_station("Alpha", is_start=True)
    net.add_station("Beta", is_accepting=True)
    net.add_transition("Alpha", "Beta", ["Express", "HighSpeed"])

    data = net.to_dict()
    reconstructed = RailwayAutomaton.from_dict(data)

    assert reconstructed.name == "Serialization Test"
    assert reconstructed.start_station == "Alpha"
    assert "Beta" in reconstructed.accepting_stations
    assert reconstructed.get_track_train_types("Alpha", "Beta") == ["Express", "HighSpeed"]
