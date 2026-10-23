"""
NFA and DFA Automata Laboratory Module.
Implements Upgrade 1: DFA vs NFA Comparison Mode.

Features:
- Formal finite automaton: M = (Q, Sigma, delta, q0, F)
- Extraction of formal automaton from railway network
- Determinism classification (DFA vs NFA, branching, missing transitions)
- Step-by-step NFA simulation with powerset active state tracking
- NFA to DFA subset (powerset) construction
- Equivalence validation comparing NFA and DFA responses on test sequences
"""

from collections import deque
from typing import Dict, List, Set, Any, Optional, Tuple


def network_to_automaton_model(
    network_dict: Dict[str, Any],
    alphabet_mode: str = "train_types",
    train_type_filter: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convert a Railway Network dictionary to a formal finite automaton dictionary:
    M = (Q, Sigma, delta, q0, F)
    """
    stations = sorted(network_dict.get("stations", []))
    start_state = network_dict.get("start_station")
    accepting_states = sorted(network_dict.get("accepting_stations", []))
    raw_edges = network_dict.get("transitions", [])

    # Determine alphabet Sigma
    if alphabet_mode == "train_types":
        if train_type_filter:
            alphabet = [train_type_filter]
        else:
            all_types = set()
            for edge in raw_edges:
                t = edge.get("train_type")
                if t:
                    all_types.add(t)
            alphabet = sorted(list(all_types)) if all_types else ["Express", "Local", "Freight"]
    else:
        # Track label alphabet mode: symbol is target station or unique edge label
        alphabet = sorted(list(set(edge.get("target") for edge in raw_edges if edge.get("target"))))

    # Build delta: transitions[state][symbol] = list of next_states
    transitions: Dict[str, Dict[str, List[str]]] = {s: {sym: [] for sym in alphabet} for s in stations}

    for edge in raw_edges:
        src = edge.get("source")
        dst = edge.get("target")
        t_type = edge.get("train_type")

        if not src or not dst:
            continue

        if alphabet_mode == "train_types":
            if train_type_filter and t_type != train_type_filter:
                continue
            if src in transitions and t_type in transitions[src]:
                if dst not in transitions[src][t_type]:
                    transitions[src][t_type].append(dst)
        else:
            # target as symbol
            if src in transitions and dst in transitions[src]:
                if dst not in transitions[src][dst]:
                    transitions[src][dst].append(dst)

    return {
        "name": network_dict.get("name", "Railway Automaton"),
        "states": stations,
        "alphabet": alphabet,
        "start_state": start_state,
        "accepting_states": accepting_states,
        "transitions": transitions,
        "alphabet_mode": alphabet_mode
    }


def classify_determinism(automaton: Dict[str, Any]) -> Dict[str, Any]:
    """
    Examine every state q in Q and input symbol sigma in Sigma:
    - Zero destinations: transition is undefined (missing).
    - One destination: deterministic for that state/symbol pair.
    - More than one destination: nondeterministic for that state/symbol pair.
    """
    states = automaton.get("states", [])
    alphabet = automaton.get("alphabet", [])
    transitions = automaton.get("transitions", {})
    start_state = automaton.get("start_state")
    accepting_states = set(automaton.get("accepting_states", []))

    nondeterministic_entries = []
    missing_entries = []
    deterministic_entries = []
    table = []

    for q in states:
        q_row = {
            "state": q,
            "is_start": (q == start_state),
            "is_accepting": (q in accepting_states),
            "transitions": {}
        }
        for sym in alphabet:
            dests = sorted(transitions.get(q, {}).get(sym, []))
            q_row["transitions"][sym] = dests

            if len(dests) > 1:
                nondeterministic_entries.append({
                    "state": q,
                    "symbol": sym,
                    "destinations": dests,
                    "count": len(dests),
                    "description": f"State '{q}' on symbol '{sym}' splits into multiple states: {dests}"
                })
            elif len(dests) == 1:
                deterministic_entries.append({
                    "state": q,
                    "symbol": sym,
                    "destination": dests[0]
                })
            else:
                missing_entries.append({
                    "state": q,
                    "symbol": sym,
                    "description": f"State '{q}' has no transition on symbol '{sym}'"
                })

        table.append(q_row)

    is_nfa = len(nondeterministic_entries) > 0
    is_strictly_complete_dfa = (not is_nfa) and (len(missing_entries) == 0)

    if is_nfa:
        classification = "NFA (Nondeterministic Finite Automaton)"
        explanation = (
            f"The network acts as an NFA because it contains {len(nondeterministic_entries)} "
            f"branching transition(s) where a single state and symbol lead to multiple candidate next states."
        )
    elif is_strictly_complete_dfa:
        classification = "Complete DFA (Deterministic Finite Automaton)"
        explanation = "Every state has exactly one defined transition for every symbol in the alphabet."
    else:
        classification = "Partial DFA (Deterministic with Dead-Ends)"
        explanation = (
            f"The transitions are deterministic (no state has multiple next states for any symbol), "
            f"but {len(missing_entries)} transition(s) are undefined. Adding a dead/trap state completes the DFA."
        )

    return {
        "classification": classification,
        "is_deterministic": not is_nfa,
        "is_complete_dfa": is_strictly_complete_dfa,
        "is_nfa": is_nfa,
        "total_states": len(states),
        "alphabet_size": len(alphabet),
        "nondeterministic_count": len(nondeterministic_entries),
        "nondeterministic_transitions": nondeterministic_entries,
        "missing_count": len(missing_entries),
        "missing_transitions": missing_entries,
        "deterministic_count": len(deterministic_entries),
        "transition_table": table,
        "explanation": explanation
    }


def simulate_nfa(automaton: Dict[str, Any], input_symbols: List[str]) -> Dict[str, Any]:
    """
    Simulate execution of an input symbol string on an NFA.
    Maintains a set of current active states across branching transitions.
    Returns full trace and acceptance decision.
    """
    start = automaton.get("start_state")
    accepting_states = set(automaton.get("accepting_states", []))
    transitions = automaton.get("transitions", {})

    if not start:
        return {
            "accepted": False,
            "input_symbols": input_symbols,
            "final_active_states": [],
            "accepting_states_reached": [],
            "trace": [],
            "message": "NFA simulation failed: No start state defined."
        }

    current = {start}
    trace = [
        {
            "step": 0,
            "symbol": None,
            "active_states": sorted(list(current)),
            "transitions": [],
            "description": f"Initial state active: {{{start}}}"
        }
    ]

    for idx, sym in enumerate(input_symbols):
        next_states = set()
        step_transitions = []

        for st in sorted(current):
            dests = transitions.get(st, {}).get(sym, [])
            for d in dests:
                next_states.add(d)
                step_transitions.append({"from": st, "to": d, "symbol": sym})

        current = next_states
        trace.append({
            "step": idx + 1,
            "symbol": sym,
            "active_states": sorted(list(current)),
            "transitions": step_transitions,
            "description": (
                f"Step {idx + 1}: Consumed '{sym}'. Active states: {{{', '.join(sorted(current))}}}"
                if current else f"Step {idx + 1}: Consumed '{sym}'. No valid transitions (trapped in empty set)."
            )
        })

        if not current:
            break

    accepting_reached = sorted(list(current & accepting_states))
    is_accepted = len(accepting_reached) > 0

    message = (
        f"Input accepted! Active state(s) {{{', '.join(accepting_reached)}}} intersect accepting states F."
        if is_accepted else
        f"Input rejected. Final active states {{{', '.join(sorted(current))}}} contain no accepting state."
    )

    return {
        "accepted": is_accepted,
        "input_symbols": input_symbols,
        "final_active_states": sorted(list(current)),
        "accepting_states_reached": accepting_reached,
        "trace": trace,
        "message": message
    }


def _format_subset_name(subset: Set[str]) -> str:
    """Format a set of states into a clean label like '{A, B}' or '∅'."""
    if not subset:
        return "∅"
    return "{" + ", ".join(sorted(subset)) + "}"


def convert_nfa_to_dfa(automaton: Dict[str, Any], include_trap: bool = True) -> Dict[str, Any]:
    """
    Subset Construction Algorithm:
    Converts an NFA M_NFA = (Q, Sigma, delta, q0, F) into an equivalent DFA M_DFA.
    Each DFA state corresponds to a subset of NFA states.
    A DFA state is accepting if it contains at least one NFA accepting state.
    """
    start_state = automaton.get("start_state")
    accepting_nfa = set(automaton.get("accepting_states", []))
    alphabet = automaton.get("alphabet", [])
    nfa_transitions = automaton.get("transitions", {})

    if not start_state:
        raise ValueError("Cannot convert NFA to DFA: No start state defined.")

    initial_subset = frozenset([start_state])
    queue = deque([initial_subset])
    visited: Set[frozenset] = {initial_subset}

    dfa_transitions: Dict[frozenset, Dict[str, frozenset]] = {}

    while queue:
        curr_subset = queue.popleft()
        dfa_transitions[curr_subset] = {}

        for sym in alphabet:
            # Union destinations from all states in curr_subset
            dest_subset_set = set()
            for st in curr_subset:
                dests = nfa_transitions.get(st, {}).get(sym, [])
                dest_subset_set.update(dests)

            dest_subset = frozenset(dest_subset_set)

            if not dest_subset and not include_trap:
                # Omit trap state transition if not requested
                continue

            dfa_transitions[curr_subset][sym] = dest_subset

            if dest_subset not in visited:
                visited.add(dest_subset)
                queue.append(dest_subset)

    # Format DFA for JSON serialization
    subset_names: Dict[frozenset, str] = {s: _format_subset_name(set(s)) for s in visited}

    dfa_states = [subset_names[s] for s in visited]
    dfa_start = subset_names[initial_subset]
    dfa_accepting = [
        subset_names[s] for s in visited if any(nfa_st in accepting_nfa for nfa_st in s)
    ]

    # Convert transitions to readable format
    formatted_transitions: Dict[str, Dict[str, str]] = {}
    edges = []
    table = []

    for s in visited:
        s_name = subset_names[s]
        formatted_transitions[s_name] = {}
        row = {
            "state": s_name,
            "nfa_subsets": sorted(list(s)),
            "is_start": (s == initial_subset),
            "is_accepting": any(nfa_st in accepting_nfa for nfa_st in s),
            "transitions": {}
        }

        for sym in alphabet:
            dest_sub = dfa_transitions.get(s, {}).get(sym)
            if dest_sub is not None:
                dest_name = subset_names[dest_sub]
                formatted_transitions[s_name][sym] = dest_name
                row["transitions"][sym] = dest_name
                edges.append({
                    "source": s_name,
                    "target": dest_name,
                    "symbol": sym
                })
            else:
                row["transitions"][sym] = "-"

        table.append(row)

    # Verify equivalence on sample symbol strings
    equivalence_checks = []
    test_inputs = []
    # Generate 1-hop and 2-hop test strings
    for sym1 in alphabet[:3]:
        test_inputs.append([sym1])
        for sym2 in alphabet[:3]:
            test_inputs.append([sym1, sym2])

    for inp in test_inputs:
        nfa_res = simulate_nfa(automaton, inp)
        # Simulate on DFA
        curr = initial_subset
        for sym in inp:
            curr = dfa_transitions.get(curr, {}).get(sym, frozenset())
        dfa_acc = any(nfa_st in accepting_nfa for nfa_st in curr)

        equivalence_checks.append({
            "input": inp,
            "nfa_accepted": nfa_res["accepted"],
            "dfa_accepted": dfa_acc,
            "equivalent": (nfa_res["accepted"] == dfa_acc)
        })

    all_equivalent = all(c["equivalent"] for c in equivalence_checks)

    return {
        "dfa": {
            "states": dfa_states,
            "start_state": dfa_start,
            "accepting_states": dfa_accepting,
            "alphabet": alphabet,
            "transitions": formatted_transitions,
            "edges": edges,
            "table": table
        },
        "subset_mapping": {subset_names[s]: sorted(list(s)) for s in visited},
        "total_dfa_states": len(dfa_states),
        "total_dfa_transitions": len(edges),
        "equivalence_verified": all_equivalent,
        "sample_equivalence_tests": equivalence_checks[:6]
    }
