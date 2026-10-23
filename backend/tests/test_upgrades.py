"""
Comprehensive pytest test suite for the Three Upgrades:
Upgrade 1: DFA vs NFA Comparison Mode (classification, NFA simulation, subset construction)
Upgrade 2: Step-by-Step Route Verification Trace (structured trace, reason codes, failure points)
Upgrade 3: Automated Test-Network Generator (all 6 fixtures: linear, branching, dead-end, disconnected, train restrictions, multiple routes)
"""

import pytest
from backend.automata.railway_automaton import RailwayAutomaton
from backend.automata.nfa_dfa import (
    network_to_automaton_model,
    classify_determinism,
    simulate_nfa,
    convert_nfa_to_dfa
)
from backend.automata.demo_networks import (
    load_all_fixtures,
    get_fixture_by_id,
    fixture_to_automaton,
    run_curated_tests
)


# =========================================================================
# UPGRADE 2 TESTS: Route Verification Trace & Reason Codes
# =========================================================================

def test_route_trace_valid_journey():
    """Valid route produces a structured trace for every hop and final acceptance."""
    net = RailwayAutomaton()
    net.set_start_station("A")
    net.set_accepting_stations(["D"])
    net.add_transition("A", "B", ["Express"])
    net.add_transition("B", "C", ["Express"])
    net.add_transition("C", "D", ["Express"])

    res = net.validate_route(["A", "B", "C", "D"], train_type="Express")
    assert res["valid"] is True
    assert res["accepted"] is True
    assert res["reason_code"] == "SUCCESS"
    assert res["failure_station"] is None
    assert res["failure_transition"] is None

    # Step-by-step trace verification
    steps = res["steps"]
    assert len(steps) == 3
    assert steps[0]["from"] == "A" and steps[0]["to"] == "B" and steps[0]["status"] == "passed"
    assert steps[1]["from"] == "B" and steps[1]["to"] == "C" and steps[1]["status"] == "passed"
    assert steps[2]["from"] == "C" and steps[2]["to"] == "D" and steps[2]["status"] == "passed"


def test_route_trace_stops_at_first_invalid_hop():
    """Invalid route stops execution at the first invalid transition and returns partial trace."""
    net = RailwayAutomaton()
    net.set_start_station("A")
    net.set_accepting_stations(["D"])
    net.add_transition("A", "B", ["Express", "Local"])
    net.add_transition("B", "C", ["Express"])  # Local NOT permitted
    net.add_transition("C", "D", ["Express", "Local"])

    res = net.validate_route(["A", "B", "C", "D"], train_type="Local")
    assert res["valid"] is False
    assert res["accepted"] is False
    assert res["failure_station"] == "B"
    assert res["failure_step"] == 1
    assert res["failure_transition"] == {"from": "B", "to": "C"}
    assert res["reason_code"] == "TRANSITION_NOT_ALLOWED"

    # Only steps evaluated up to failure point should be in trace
    steps = res["steps"]
    assert len(steps) == 2
    assert steps[0]["status"] == "passed"
    assert steps[1]["status"] == "failed"
    assert steps[1]["reason_code"] == "TRANSITION_NOT_ALLOWED"


def test_route_trace_missing_physical_track():
    """Track does not exist in graph: flagged as MISSING_TRANSITION."""
    net = RailwayAutomaton()
    net.set_start_station("A")
    net.set_accepting_stations(["C"])
    net.add_transition("A", "B", ["Express"])

    res = net.validate_route(["A", "B", "C"], train_type="Express")
    assert res["valid"] is False
    assert res["reason_code"] == "MISSING_TRANSITION"
    assert res["failure_transition"] == {"from": "B", "to": "C"}
    assert len(res["steps"]) == 2
    assert res["steps"][1]["status"] == "failed"


def test_route_trace_non_accepting_destination():
    """All transitions pass, but terminal station is not an accepting state."""
    net = RailwayAutomaton()
    net.set_start_station("A")
    net.set_accepting_stations(["Z"])  # D is not accepting
    net.add_transition("A", "B", ["Express"])
    net.add_transition("B", "C", ["Express"])

    res = net.validate_route(["A", "B", "C"], train_type="Express")
    assert res["valid"] is False
    assert res["reason_code"] == "DESTINATION_NOT_ACCEPTING"
    assert res["failure_station"] == "C"
    assert len(res["steps"]) == 2
    assert all(s["status"] == "passed" for s in res["steps"])
    assert res.get("is_accepting_destination") is False


def test_route_trace_empty_and_unknown_station():
    """Empty route and nonexistent stations produce clear errors without crashing."""
    net = RailwayAutomaton()
    net.add_station("A")

    res_empty = net.validate_route([], train_type="Express")
    assert res_empty["valid"] is False
    assert res_empty["reason_code"] == "INVALID_ROUTE_FORMAT"

    res_unknown = net.validate_route(["UnknownStation", "A"], train_type="Express")
    assert res_unknown["valid"] is False
    assert res_unknown["reason_code"] == "UNKNOWN_STATION"


# =========================================================================
# UPGRADE 1 TESTS: DFA vs NFA Comparison, Simulation & Subset Construction
# =========================================================================

def test_nfa_branching_and_determinism_classification():
    """Branching transitions are classified as NFA, single transitions as DFA."""
    # Build explicit branching network
    fixture = get_fixture_by_id("branching")
    assert fixture is not None
    auto = fixture_to_automaton(fixture)
    model = network_to_automaton_model(auto.to_dict(), alphabet_mode="train_types", train_type_filter="Express")

    classification = classify_determinism(model)
    assert classification["is_nfa"] is True
    assert classification["is_deterministic"] is False
    assert classification["nondeterministic_count"] >= 1

    # In branching network, Station A splits on Express to both B and C
    branch_states = [nt["state"] for nt in classification["nondeterministic_transitions"]]
    assert "A" in branch_states


def test_nfa_simulation_acceptance_and_rejection():
    """NFA simulation tracks active subsets and accepts if any branch accepts."""
    # Simple NFA: start A, transitions: (A, Express) -> B and C, (B, Express) -> D, (C, Express) -> E
    # Accepting state: D
    auto = RailwayAutomaton()
    auto.set_start_station("A")
    auto.set_accepting_stations(["D"])
    auto.add_transition("A", "B", ["Express"])
    auto.add_transition("A", "C", ["Express"])
    auto.add_transition("B", "D", ["Express"])
    auto.add_transition("C", "E", ["Express"])

    model = network_to_automaton_model(auto.to_dict(), alphabet_mode="train_types", train_type_filter="Express")

    # Sequence ["Express", "Express"]: from A, step 1 -> {B, C}, step 2 -> {D, E}. D is accepting -> ACCEPT!
    sim_accept = simulate_nfa(model, ["Express", "Express"])
    assert sim_accept["accepted"] is True
    assert "D" in sim_accept["accepting_states_reached"]
    assert len(sim_accept["trace"]) == 3
    assert set(sim_accept["trace"][1]["active_states"]) == {"B", "C"}
    assert set(sim_accept["trace"][2]["active_states"]) == {"D", "E"}

    # Single hop ["Express"]: from A -> {B, C}. Neither is accepting -> REJECT!
    sim_reject = simulate_nfa(model, ["Express"])
    assert sim_reject["accepted"] is False
    assert len(sim_reject["accepting_states_reached"]) == 0


def test_subset_construction_and_dfa_equivalence():
    """Subset construction converts NFA to DFA and verifies equivalence on test strings."""
    fixture = get_fixture_by_id("branching")
    auto = fixture_to_automaton(fixture)
    model = network_to_automaton_model(auto.to_dict(), alphabet_mode="train_types", train_type_filter="Express")

    dfa_res = convert_nfa_to_dfa(model, include_trap=True)
    dfa = dfa_res["dfa"]

    # Converted DFA states are string representations of subsets
    assert len(dfa["states"]) > 0
    assert dfa["start_state"] == "{A}"
    # Verify equivalence flag
    assert dfa_res["equivalence_verified"] is True

    # Ensure every state in DFA has deterministic transitions (at most 1 destination per symbol)
    for state_name, trans_map in dfa["transitions"].items():
        for sym, dest in trans_map.items():
            assert isinstance(dest, str)


# =========================================================================
# UPGRADE 3 TESTS: Predefined Fixtures & Automated Test Suite
# =========================================================================

def test_all_six_fixtures_load():
    """All 6 required fixtures exist, load successfully, and have expected schemas."""
    fixtures = load_all_fixtures()
    assert len(fixtures) >= 6
    fixture_ids = [f["id"] for f in fixtures]
    for required_id in ["linear", "branching", "dead-end", "disconnected", "train-restrictions", "multiple-routes"]:
        assert required_id in fixture_ids


def test_fixture_curated_suite_passes():
    """The in-app curated verification suite executes and reports 100% pass rate."""
    suite_result = run_curated_tests()
    assert suite_result["total_tests"] >= 7
    assert suite_result["total_failed"] == 0
    assert suite_result["all_passed"] is True
