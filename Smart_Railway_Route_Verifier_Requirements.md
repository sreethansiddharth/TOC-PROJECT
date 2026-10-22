# Smart Railway Route Verifier --- Build Requirements

## 1. Project Overview

**Project name:** Smart Railway Route Verifier\
**Project domain:** Theory of Computation / Automata Theory\
**Purpose:** Build an interactive tool that models railway stations and
track connections as a finite automaton and verifies whether a proposed
train journey is valid under the selected train-type restrictions.

The system must represent stations as states and tracks as transitions.
It must validate proposed routes, identify dead-end and unreachable
stations, compute the shortest valid route, visualize the railway
network, and generate a verification report.

## 2. Aim

Design and implement a system that models railway stations and routes as
a finite automaton and applies automata-theoretic techniques to: -
Verify the legality of a proposed train journey. - Detect invalid and
dead-end routes. - Determine the shortest accepted path between a source
and destination station.

## 3. Core Objectives

The application must: 1. Represent railway stations as automaton states
and track segments as transitions. 2. Provide an interactive interface
to create and modify railway networks. 3. Support multiple train types,
each with its own permitted transitions. 4. Detect invalid routes that
violate transition rules. 5. Identify dead-end states that have no valid
onward transition for the selected train type. 6. Compute the shortest
accepted path between two stations. 7. Visually represent the network
and highlight a verified route. 8. Check the structural consistency of
the network independently of a route query. 9. Save and reload railway
network configurations. 10. Generate a concise validation report for
each route check.

## 4. Functional Requirements

### 4.1 Railway Network Builder / User Interface

Users must be able to: - Add and remove stations. - Mark a start
station. - Mark one or more destination/accepting stations. - Create
track connections between stations. - Label each track transition with
the train types permitted to use it. - Edit or delete existing network
configurations.

### 4.2 Route Input and Encoding

The user must be able to specify: - Source station. - Destination
station. - Train type. - Proposed route as an ordered sequence of
stations, when checking a specific route.

The Route Encoder must translate the user-provided journey into a
representation that the automaton can validate. The route representation
must preserve the order of stations and the selected train type.

### 4.3 Automata Validation Engine

The validation engine must check: - Whether the start/source station
exists and is valid. - Whether the destination/accepting station exists
and is valid. - Whether every consecutive station pair in the proposed
route has a defined transition. - Whether each transition is permitted
for the selected train type. - Whether the route ends at an
accepting/destination station. - Whether the route should be accepted or
rejected.

For an invalid route, the system must report: - The station where the
route first fails. - Whether the issue is a missing track connection or
a train-type restriction, where this can be determined from the network
definition. - Whether the destination is unreachable due to network
structure.

### 4.4 Dead-End Detection

The system must scan the network and identify **non-accepting stations
with no outgoing transitions for the selected train type**.

It must: - List detected dead-end stations. - Avoid flagging accepting
stations as dead ends solely because they have no outgoing
transitions. - Make dead-end states visually distinguishable in the
network view.

### 4.5 Shortest Accepted Path Finder

The system must: - Use **breadth-first search (BFS)** to find the
minimum-hop path between a source and destination. - Consider only
transitions permitted for the selected train type. - Return the shortest
route when one exists. - Indicate that no route exists when the
destination is unreachable. - Display the resulting path to the user.

The shortest path is measured by the number of station-to-station hops
in the base project. Distance, time, and fare weighting are future-scope
enhancements.

### 4.6 Network Consistency Checker

The system must perform a network-wide check independently of an
individual route query. It must: - Find stations unreachable from the
start station for a selected train type. - Flag orphaned stations with
no incoming or outgoing tracks. - Detect duplicate or conflicting
transition definitions. - Present the identified structural issues to
the user.

### 4.7 Route Visualization

The application must display the railway network as a graph: - Stations
are shown as nodes. - Track connections are shown as edges. - The start
station is visually identified. - Accepting/destination stations are
visually identified. - A verified route is highlighted. - Dead-end
stations are highlighted. - The visualization must make route-validation
results easy to understand.

### 4.8 Report Generator

For each verification run, generate a concise report containing, as
applicable: - Proposed route. - Selected train type. - Accepted/rejected
status. - Reason for rejection, if any. - Station where the route
failed, if any. - Dead-end stations. - Unreachable stations. - Shortest
accepted path. - Relevant network-consistency findings.

The report should be shareable or exportable.

### 4.9 Save and Reload

Users must be able to save a railway network configuration and reload it
later for repeated route verification. Saved data should include
stations, start and accepting stations, transitions, and permitted train
types.

## 5. Automata and Data Model Requirements

### 5.1 Automaton Model

Use a finite-automaton representation: - **States:** Railway stations. -
**Alphabet/input labels:** Train types, as described in the project
proposal. - **Transitions:** Permitted station-to-station movements for
a train type. - **Start state:** The selected starting station. -
**Accepting states:** Valid destination stations.

The proposed transition structure is an adjacency mapping keyed by
`(current_station, train_type)` and mapping to a set of reachable next
stations.

This allows: - DFA-like behaviour when there is at most one next station
for a given station/train-type pair. - NFA-like behaviour when multiple
next stations are available for the same station/train-type pair.

### 5.2 Core Operations

The backend automaton model must support operations equivalent to: - Add
a station. - Add a track/transition. - Validate a route. - Find dead
ends for a train type. - Find the shortest route. - Find stations
unreachable from the start. - Generate a verification report.

### 5.3 Example Scenario from the Proposal

Example network: - Express: `A → B → C → D` - Local: `A → B → E`

Expected behaviour: - An Express route from A to D is accepted. - The
same proposed route for a Local train is rejected at B because no Local
transition from B to C exists. - The report identifies B as the point of
failure.

## 6. System Architecture Requirements

Implement the system as the following cooperating layers:

1.  **User Input:** Collect source, destination, train type, and
    proposed route.
2.  **Route Encoder:** Converts the user-facing route into the internal
    representation.
3.  **Automata Validation Engine:** Checks the proposed route.
4.  **Railway Network Model:** Stores states and transitions and
    supplies them to the validation engine.
5.  **Dead-End Detector:** Finds non-accepting states without outgoing
    transitions for a selected train type.
6.  **Shortest Path Finder:** Computes the minimum-hop route using BFS.
7.  **Network Consistency Checker:** Checks reachability and structural
    issues independently of a route query.
8.  **Route Visualization / Report Generator:** Presents the network and
    validation results.

The automaton core should remain independent of the user interface so
that it can be tested and reused separately.

## 7. Technology Requirements

The project document proposes the following technology choices:

  Layer / Concern                           Proposed technology
  ----------------------------------------- --------------------------------------
  Automata modelling and graph algorithms   Python
  Interactive frontend                      JavaScript with React.js
  Network graph visualization               D3.js or Graphviz
  Backend API                               Flask **or** Node.js with Express.js
  Database                                  MySQL **or** PostgreSQL
  Automated testing                         pytest
  Version control and collaboration         Git and GitHub

**Implementation note:** Select one option where the proposal lists
alternatives. The sample automata implementation is in Python, so a
Python backend using Flask is the most direct way to retain that
implementation. React can communicate with the backend through API
endpoints. This is an implementation recommendation, not a mandatory
choice stated in the proposal.

## 8. Backend/API Requirements

The backend must expose operations that allow the frontend to: - Create,
update, and delete stations. - Create, update, and delete track
transitions. - Set the start and accepting stations. - Retrieve a saved
network. - Validate a proposed route for a selected train type. -
Retrieve dead-end and unreachable-station results. - Compute the
shortest route. - Run the network consistency check. - Generate and
export a verification report.

The project proposal specifies that the backend should expose validation
functionality through API endpoints, but it does **not** define exact
endpoint URLs, request schemas, or response schemas. These should be
specified during implementation.

## 9. Data Persistence Requirements

Persist at least: - Network/configuration identifier and name. -
Stations. - Start station. - Accepting/destination stations. - Track
transitions. - Train types permitted on each transition. - Saved
verification reports, if report history is implemented.

The proposal specifies MySQL or PostgreSQL but does not define a
database schema. Table design and relationships must be decided during
implementation.

## 10. Testing and Validation Requirements

Use `pytest` to test the automata and analysis modules.

Tests must cover: - A valid/accepted route. - A route rejected because a
transition is missing. - A route rejected because a transition is
restricted for the selected train type. - A simple linear network. - A
branching network with multiple valid paths. - A network containing
intentional dead ends. - A fully disconnected network. - Correct
dead-end detection, without false positives on accepting stations. -
Shortest-path correctness when a route exists. - Returning no route when
the destination is unreachable. - Correct identification of stations
unreachable from the start. - Manual walkthrough tests of the graphical
builder once it is implemented, ensuring the displayed network matches
the internal automaton.

Additional edge cases worth testing during implementation include an
unknown source/destination, an empty route, a source equal to
destination, duplicate transitions, and removal of stations referenced
by transitions. These are sensible implementation tests; they are not
individually specified in the proposal.

## 11. Expected Outputs

The completed application should be able to: - Model a railway network
as a finite automaton. - Verify whether a train can legally travel from
a source to a destination. - Detect invalid routes and identify the
failure point and reason. - Identify dead-end stations. - Compute and
display the shortest accepted path. - Display the railway network and
verified path graphically. - Detect orphaned or unreachable stations and
other structural inconsistencies. - Generate and export a verification
report for each route check. - Save and reload network configurations.

## 12. User Interface Pages / Views

The document requires an interactive interface and graph visualization
but does not prescribe exact pages. A practical UI derived from those
requirements may include:

1.  **Network Builder:** Add/edit/delete stations and tracks; set start
    and accepting states.
2.  **Route Verifier:** Select source, destination, train type, and
    enter a proposed route.
3.  **Network Visualization:** View stations, transitions, verified
    paths, accepting states, and dead ends.
4.  **Analysis Results:** View dead ends, unreachable stations,
    consistency warnings, and shortest path.
5.  **Saved Networks:** Save, load, edit, and delete network
    configurations.
6.  **Verification Report:** Review and export results.

These views are a suggested organization of the required functionality,
not a page list explicitly mandated by the source document.

## 13. Future Scope --- Not Required for the Initial Version

The proposal identifies the following possible future enhancements: -
Weighted automata for real distances, travel times, and fares. -
Real-time scheduling and platform-availability constraints. -
Integration with live railway data sources. - Multiple simultaneous
trains with collision and conflict detection. - DFA/NFA conversion with
step-by-step explanations. - Mobile application support. - Cloud
deployment for shared network configurations. - Accessibility
improvements, including colour-blind-friendly palettes and screen-reader
support.

These should be treated as future scope rather than core requirements
for the first working version unless the project team explicitly expands
the scope.

## 14. Suggested Implementation Order

The following order is a practical plan derived from the proposal:

1.  Implement the Python railway automaton model.
2.  Implement and test route validation.
3.  Implement dead-end detection and train-type-specific reachability.
4.  Implement BFS shortest-path search.
5.  Implement network consistency checks.
6.  Implement report generation.
7.  Design the database schema and persistence layer.
8.  Build the backend API.
9.  Build the React network builder and route-verification interface.
10. Integrate graph visualization with D3.js or Graphviz.
11. Add save/reload and report export.
12. Run unit, integration, and manual UI tests.

## 15. Definition of Done

The initial version can be considered complete when: - A user can create
and edit a network of stations and train-restricted tracks. - A user can
submit a route and train type and receive an accepted/rejected result. -
Invalid routes identify the point of failure and a meaningful reason. -
Dead-end and unreachable stations are detected for the selected train
type. - The shortest valid route is computed using BFS. - Network
consistency issues are reported. - The graph view highlights relevant
stations and routes. - Network configurations can be saved and
reloaded. - A verification report can be generated and exported. - The
core automata and graph algorithms pass the specified pytest cases.

## 16. Source-Document Notes

This requirements file is based on the uploaded **"Smart Railway Route
Verifier"** Theory of Computation project proposal. The proposal defines
the goal, core modules, suggested technologies, example network,
expected outcomes, future scope, and testing strategy.

The proposal does not fully specify authentication, user roles, exact
API endpoints, detailed database schema, deployment provider, or a
particular frontend design system. Those items should not be treated as
mandatory requirements unless separately decided by the project team.
