# Smart Railway Route Verifier --- Three Upgrade Implementation Guide

## Purpose

This guide explains how to implement three upgrades for the Smart
Railway Route Verifier:

1.  DFA vs NFA Comparison Mode
2.  Step-by-Step Route Verification Trace
3.  Automated Test-Network Generator

The source proposal describes railway stations as states, train-specific
track movements as transitions, valid destinations as accepting states,
and includes route validation, dead-end detection, BFS shortest paths,
network consistency checks, visualization, reports, and pytest testing.
Detailed UI, API contracts, and implementation steps below are
recommendations extending that proposal.

## Recommended stack

-   Frontend: React with TypeScript
-   Graph visualization: D3.js
-   Backend: Python with Flask
-   Algorithms: Python
-   Testing: pytest
-   Version control: Git and GitHub
-   Persistence: PostgreSQL or MySQL if required

Choose one backend and database rather than implementing every
alternative.

------------------------------------------------------------------------

# Upgrade 1 --- DFA vs NFA Comparison Mode

## Goal

Create an Automata Lab that explains deterministic and nondeterministic
transitions. Optionally, allow users to convert an NFA to an equivalent
DFA and compare their behaviour.

## Modelling decision

The proposal uses train types to filter permitted transitions and
describes transitions keyed by `(current_station, train_type)`. For
formal DFA/NFA comparison, define the alphabet and transition function
explicitly. A formal finite automaton is:

`M = (Q, Σ, δ, q0, F)`

-   `Q`: states/stations.
-   `Σ`: input symbols, such as explicitly defined track labels.
-   `δ`: transition function.
-   `q0`: start state.
-   `F`: accepting states.

Treat train type as a filter over permitted transitions. Decide whether
formal input symbols are track labels or another explicit
representation. Do not ambiguously treat train types as the alphabet
while also using them as route permissions.

A simpler version may identify whether a station/train-type pair has
zero, one, or multiple next stations. Describe this as a simplified
transition-system view. A complete formal DFA requires exactly one
destination for every state/input-symbol pair.

## Requirements

-   Select a network and train type.
-   Display states, start state, accepting states, and permitted
    transitions.
-   Show a transition table.
-   Detect state/input pairs with multiple destinations.
-   Explain deterministic, nondeterministic, and missing-transition
    cases.
-   Optionally simulate an input string.
-   Optionally convert an NFA to an equivalent DFA using subset
    construction.
-   Display the converted DFA graph and table.
-   Explain acceptance or rejection in simple language.

## UI design

Create an **Automata Lab** page with a network selector, train-type
selector, original graph, determinism summary, transition table, input
simulation area, and (if implemented) a "Convert NFA to DFA" button with
a converted graph and table. Include a legend for start, accepting,
ordinary, and dead states.

## Implementation steps

### Step 1: Define formal transition data

Illustrative model:

``` python
nfa = {
    "states": {"A", "B", "C", "D", "E"},
    "alphabet": {"ab", "bc", "be", "cd"},
    "start_state": "A",
    "accepting_states": {"D"},
    "transitions": {
        ("A", "ab"): {"B"},
        ("B", "bc"): {"C"},
        ("B", "be"): {"E"},
        ("C", "cd"): {"D"},
    },
}
```

Adapt symbols to the chosen model. This is an example, not a required
schema.

### Step 2: Classify transitions

For each state and input symbol: - Zero destinations: transition is
undefined. - One destination: deterministic for that state/symbol
pair. - More than one destination: nondeterministic for that
state/symbol pair.

If a complete DFA is required, add a dead state for missing transitions.

### Step 3: Simulate an NFA

Maintain a set of current states. For each input symbol, collect every
destination reachable from any current state. After consuming the input,
accept if at least one current state is accepting.

``` text
current = {start_state}
for symbol in input:
    next_states = union of destinations from every state in current
    current = next_states
accept if current intersects accepting_states
```

### Step 4: Convert NFA to DFA with subset construction

Each DFA state represents a set of NFA states.

1.  Start with `{start_state}`.
2.  For each discovered subset and each symbol, union destinations from
    all states in that subset.
3.  Record the resulting subset as the DFA transition destination.
4.  Add newly discovered subsets to a work queue until none remain.
5.  A subset is accepting if it contains at least one NFA accepting
    state.
6.  Include the empty-set state if a complete DFA is required.

### Step 5: Visualize

Label subset states clearly, such as `{A}`, `{B,C}`, and `∅`. Keep the
graph zoomable. Generate the graph and transition table from the same
data.

## Suggested backend functions

``` python
def classify_determinism(automaton):
    """Report missing and multiple-destination transitions."""

def simulate_nfa(automaton, input_symbols):
    """Return acceptance and an optional execution trace."""

def convert_nfa_to_dfa(automaton):
    """Return an equivalent DFA using subset construction."""
```

## Tests

-   A deterministic transition table is classified correctly.
-   Multiple destinations for one state/input pair are identified.
-   NFA simulation accepts when at least one path reaches an accepting
    state.
-   NFA simulation rejects when no path accepts.
-   Subset construction handles the empty-set state.
-   Converted DFA and original NFA agree on all test strings in the
    suite.

## Completion criteria

-   Formal alphabet and transition semantics are documented.
-   Transition table and graph agree.
-   Classification and simulation are correct.
-   Subset construction works if included.
-   UI explains results clearly.

------------------------------------------------------------------------

# Upgrade 2 --- Step-by-Step Route Verification Trace

## Goal

Show how the validator evaluates each station-to-station hop instead of
displaying only "Accepted" or "Rejected."

## Requirements

The trace must show: - Proposed route and selected train type. - Current
and next station for each step. - Whether the transition is permitted. -
Pass/fail status. - First failure point and reason. - Whether the final
station is accepting. - Final route result.

Optional controls: **Next Step**, **Previous Step**, **Play**, and
**Reset**.

The backend should generate the trace once. The frontend should replay
it rather than implementing its own validation rules.

## Example

Network: - Express: `A → B → C → D` - Local: `A → B → E` - Accepting
destination: `D`

For Express, `A → B → C → D` succeeds. For Local, the same proposed
route fails at `B → C` because no permitted Local transition exists from
B to C.

## Suggested trace response

``` json
{
  "valid": false,
  "train_type": "Local",
  "route": ["A", "B", "C", "D"],
  "failure_station": "B",
  "failure_transition": {"from": "B", "to": "C"},
  "reason_code": "TRANSITION_NOT_ALLOWED",
  "message": "No permitted Local transition from B to C.",
  "steps": [
    {
      "index": 1,
      "from": "A",
      "to": "B",
      "status": "passed",
      "message": "Transition is permitted."
    },
    {
      "index": 2,
      "from": "B",
      "to": "C",
      "status": "failed",
      "message": "No permitted Local transition from B to C."
    }
  ]
}
```

This is a proposed contract. Agree on final field names between frontend
and backend developers.

## Backend implementation steps

1.  Validate route format, station existence, and train type.
2.  Iterate over consecutive station pairs.
3.  Check whether each transition is permitted for the selected train
    type.
4.  Append a structured trace step.
5.  Stop at the first invalid transition and return the partial trace.
6.  If every hop passes, check whether the final station is accepting.
7.  Return the final result and trace using a consistent response
    schema.

Suggested reason codes: - `UNKNOWN_STATION` - `UNKNOWN_TRAIN_TYPE` -
`MISSING_TRANSITION` - `TRANSITION_NOT_ALLOWED` -
`DESTINATION_NOT_ACCEPTING` - `INVALID_ROUTE_FORMAT`

Distinguishing a physically missing track from a train-restricted track
is possible only if the data model stores physical track connections
separately from train permissions. If it stores only permitted
transitions, report a missing permitted transition rather than guessing
the cause.

## Frontend implementation steps

1.  Submit the route to the backend.
2.  Receive the structured trace.
3.  Display the route and its steps.
4.  Reveal one step at a time with Next/Previous controls.
5.  Highlight the current station and edge in the D3 graph.
6.  Highlight the first failed transition on rejection.
7.  Reset playback without changing the network.

Use stable station and edge IDs so the trace can highlight the correct
graph elements.

## Suggested endpoint

`POST /api/routes/verify`

Illustrative request:

``` json
{
  "network_id": "demo-network",
  "source": "A",
  "destination": "D",
  "train_type": "Local",
  "route": ["A", "B", "C", "D"]
}
```

The exact endpoint and schema are implementation choices; the source
proposal does not prescribe them.

## Tests

-   Valid route produces a trace for every hop and final acceptance.
-   Invalid route stops at the first invalid transition.
-   Failure station and reason are correct.
-   A non-accepting final station is rejected.
-   Empty route and unknown station produce clear errors.
-   UI playback matches the backend trace.
-   Final result agrees with the trace.

## Completion criteria

-   Backend returns a structured trace.
-   Frontend supports step-by-step playback.
-   Current and failed edges are highlighted.
-   Route validation remains implemented in one place.
-   Invalid input does not crash the application.

------------------------------------------------------------------------

# Upgrade 3 --- Automated Test-Network Generator

## Goal

Provide predefined networks for demonstrations and reusable fixtures for
automated tests.

This upgrade has two parts: 1. **Demo-network library** in the app. 2.
**pytest suite** for algorithm correctness.

A UI "Run All Tests" button does not replace the developer test suite.
It can run curated, safe application-level checks.

## Required demo scenarios

### A. Linear network

``` text
A → B → C → D
```

Purpose: accepted route and simple shortest path.

### B. Branching network

``` text
      → B →
A           D
      → C →
```

Purpose: multiple possible routes and BFS correctness.

### C. Dead-end network

``` text
A → B → C → D
    |
    └→ E
```

Configure E as non-accepting with no outgoing transition for the
selected train type. Expected: E is flagged as a dead end.

### D. Disconnected network

``` text
A → B → C

X → Y
```

Expected: X and Y are unreachable from A for the selected train type.

### E. Train-restricted network

``` text
Express: A → B → C → D
Local:   A → B → E
```

Expected: Express route A-B-C-D is accepted; the same proposed route for
Local fails at B-C.

### F. Multiple-route network

Create at least three routes from source to destination with different
hop counts. Expected: BFS returns a minimum-hop route using only
permitted transitions.

Document exact transitions, accepting states, and expected results for
every fixture.

## Suggested fixture format

``` json
{
  "id": "train-restrictions",
  "name": "Train Type Restrictions",
  "description": "Shows different permitted routes for Express and Local trains.",
  "start_station": "A",
  "accepting_stations": ["D"],
  "stations": ["A", "B", "C", "D", "E"],
  "transitions": [
    {"from": "A", "to": "B", "train_types": ["Express", "Local"]},
    {"from": "B", "to": "C", "train_types": ["Express"]},
    {"from": "C", "to": "D", "train_types": ["Express"]},
    {"from": "B", "to": "E", "train_types": ["Local"]}
  ]
}
```

This format separates physical connections from train permissions. Adapt
it to the existing model or add a conversion layer.

## Backend implementation steps

1.  Store fixtures in a dedicated directory or Python module.
2.  Validate each fixture when loading it.
3.  Convert it into the same network model used for user-created
    networks.
4.  Add an endpoint to list demos.
5.  Add an endpoint to retrieve a selected demo.
6.  Ensure demo networks do not overwrite user-created networks.
7.  Reuse fixtures in tests where practical.

Suggested endpoints: - `GET /api/demo-networks` -
`GET /api/demo-networks/{network_id}`

These are recommendations, not endpoint names mandated by the source
document.

## Suggested project structure

``` text
backend/
  app/
    automaton.py
    route_validator.py
    graph_algorithms.py
    nfa_dfa.py
    demo_networks.py
    api.py
  fixtures/
    linear.json
    branching.json
    dead_end.json
    disconnected.json
    train_restrictions.json
    multiple_routes.json
  tests/
    test_route_validation.py
    test_shortest_path.py
    test_dead_ends.py
    test_reachability.py
    test_nfa_dfa.py
```

Adapt the structure to the existing repository rather than reorganizing
unnecessarily.

## pytest test matrix

  -----------------------------------------------------------------------
  Test                                Expected result
  ----------------------------------- -----------------------------------
  Valid route                         Accepted

  Missing permitted transition        Rejected at first invalid hop

  Train-type restriction              Rejected with clear reason

  Non-accepting destination           Rejected

  Non-accepting station with no       Flagged as dead end
  outgoing transition                 

  Accepting terminal station          Not flagged solely for having no
                                      outgoing transition

  Multiple paths with different hop   A minimum-hop path returned
  counts                              

  Unreachable destination             No route returned

  Unreachable stations                Correct set returned

  NFA branching                       All possible destinations retained

  NFA-to-DFA conversion               Acceptance agrees across tested
                                      strings

  Unknown station or malformed route  Clear error, no crash
  -----------------------------------------------------------------------

When multiple shortest paths exist, assert that the result is one of the
minimum-length paths unless a tie-breaking rule is specified.

Example test, adapted to the implementation's return type:

``` python
def test_express_route_is_accepted(express_network):
    valid, reason = express_network.is_valid_route(
        ["A", "B", "C", "D"],
        "Express",
    )
    assert valid is True
    assert reason is None
```

## Test Lab UI

Create a page containing: - Demo-network selector. - Scenario
description. - Load Network button. - Run Verification button. - Run
Network Analysis button. - Expected result and actual result. -
Pass/fail status.

If implementing Run All Tests in the web application, run only curated
application-level checks. Do not expose arbitrary shell commands or
allow users to submit arbitrary Python code. Keep the full pytest suite
as a developer-run test suite unless a controlled runner is deliberately
designed.

## Completion criteria

-   At least six demo networks can be loaded.
-   Demos use the same model as ordinary networks.
-   Every fixture has documented expected results.
-   pytest covers the core algorithms.
-   UI reports test outcomes clearly.
-   Tests are repeatable and do not overwrite user-created networks.
-   Documented test command works.

------------------------------------------------------------------------

# How the upgrades fit together

``` text
                 Shared Railway Network Model
                            |
          +-----------------+-----------------+
          |                 |                 |
          v                 v                 v
   Route Validator     Automata Lab      Demo Fixtures
          |             DFA / NFA              |
          v             Simulation             v
   Trace Generator       |                pytest suite
          |               |                    |
          +---------------+--------------------+
                          |
                          v
                Shared API / Result Models
                          |
                          v
                    React Frontend
                          |
             +------------+------------+
             |            |            |
             v            v            v
         Route Trace   Automata Lab   Test Lab
```

Integration rules: 1. Maintain one shared network model. 2. Apply
train-type permissions consistently in validation, reachability,
dead-end detection, and shortest-path search. 3. Keep formal NFA/DFA
conversion separate until alphabet and transition semantics are
explicit. 4. Return structured backend results; let the frontend render
and animate them. 5. Reuse demo fixtures in the UI and automated tests.
6. Keep graph IDs aligned with backend station and edge IDs.

------------------------------------------------------------------------

# Two-member work division

## Member 1 --- Automata and backend

-   Define the network model and train-permission rules with Member 2.
-   Implement route validation and structured traces.
-   Implement BFS, reachability, and dead-end detection.
-   Implement determinism classification and NFA simulation.
-   Implement subset construction if included.
-   Create fixtures and pytest tests.
-   Maintain backend API contracts.

## Member 2 --- Frontend and visualization

-   Build the React network and route UI.
-   Render stations and tracks using D3.js.
-   Display route traces with step controls.
-   Highlight current and failed transitions.
-   Build Automata Lab and transition table.
-   Build Test Lab and demo-network selector.
-   Integrate backend endpoints and run UI tests.

## Work together

-   Agree on JSON structures and API responses before parallel
    development.
-   Review each other's code.
-   Test the complete user journey.
-   Prepare viva explanations of automata, BFS, NFA simulation, and
    subset construction.

------------------------------------------------------------------------

# Recommended development order

1.  Agree on the shared network schema and train-permission rules.
2.  Complete and test the core route validator.
3.  Add structured route traces to the backend.
4.  Build the frontend trace panel and graph highlighting.
5.  Add six demo-network fixtures.
6.  Add pytest tests for validation, BFS, dead ends, and reachability.
7.  Build the Test Lab UI.
8.  Define the formal alphabet for DFA/NFA mode.
9.  Add determinism classification and a transition table.
10. Add NFA simulation.
11. Add subset construction if time permits.
12. Run integration tests and update documentation.

For a two-member team, complete the route trace and fixtures before
formal NFA-to-DFA conversion. This reduces risk while preserving a
strong academic demonstration.

------------------------------------------------------------------------

# Definition of done

## Upgrade 1 --- DFA/NFA comparison

-   [ ] Formal automaton and alphabet are documented.
-   [ ] Determinism and nondeterminism are detected correctly.
-   [ ] Transition table and graph agree.
-   [ ] NFA simulation works.
-   [ ] Subset construction works if included.
-   [ ] Converted DFA and NFA agree on test strings.

## Upgrade 2 --- Route trace

-   [ ] Backend returns a structured trace.
-   [ ] Invalid routes stop at the first failed transition.
-   [ ] Accepting destination is checked.
-   [ ] Frontend supports step-by-step playback.
-   [ ] Current and failed edges are highlighted.
-   [ ] Malformed inputs produce clear errors.

## Upgrade 3 --- Test networks

-   [ ] Six example networks are available.
-   [ ] Each example has expected outcomes.
-   [ ] Demos use the same model as normal networks.
-   [ ] pytest covers core algorithms and failure cases.
-   [ ] Test Lab shows understandable results.
-   [ ] Tests do not overwrite user-created networks.

## Overall

-   [ ] Existing project requirements continue to work.
-   [ ] Frontend and backend use consistent transition rules.
-   [ ] Setup and test instructions work on a clean environment.
-   [ ] Both members can explain the model and upgrades.

------------------------------------------------------------------------

# Source basis and boundaries

This guide is based on the uploaded *Smart Railway Route Verifier*
Theory of Computation proposal. The proposal supports the
finite-automaton railway model, train-specific transitions, route
validation, dead-end detection, BFS shortest paths, consistency
checking, visualization, reporting, and pytest testing.

The formal subset-construction procedure, demo JSON schema, API
endpoints, UI controls, file structure, and team plan are additional
implementation recommendations. The original proposal does not prescribe
these exact designs.
