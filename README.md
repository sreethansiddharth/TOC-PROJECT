# Smart Railway Route Verifier — Project Guide & Documentation

## 1. Project Overview & Architecture
The **Smart Railway Route Verifier** is an interactive, automata-theoretic application built according to the Theory of Computation (TOC) specifications. It models railway networks as a **Finite Automaton** $(Q, \Sigma, \delta, q_0, F)$:

- **States ($Q$)**: Railway stations (e.g., Central Station, Bridgeview, Westfield Terminal).
- **Alphabet ($\Sigma$)**: Train service types (`Express`, `Local`, `Freight`, `HighSpeed`).
- **Transitions ($\delta$)**: Track connections permitted for specific train types: $\delta(q, \sigma) \to \{q'\}$.
- **Start State ($q_0$)**: Source station for a train journey.
- **Accepting States ($F$)**: Permitted terminus/destination stations.

---

## 2. Implemented Components

### Backend (`/backend`)
- **Automata Model & Engine** ([railway_automaton.py](file:///c:/Users/sreet/Downloads/TOC%20ProJECT/backend/automata/railway_automaton.py)):
  - **Route Validation Engine**: Step-by-step verification of station sequences, identifying exact failure station and differentiating between `MISSING_TRACK`, `TRAIN_RESTRICTION`, and `NOT_ACCEPTING`.
  - **Dead-End Detector**: Scans the network for non-accepting stations with zero permitted outward connections for a given train type (while correctly never flagging accepting stations).
  - **BFS Shortest Path Finder**: Computes the minimum-hop accepted route under train type restrictions.
  - **Network Consistency Checker**: Discovers unreachable stations from $q_0$, orphan stations, and disconnected components.
  - **Verification Report Generator**: Produces formal audit logs with export capabilities.
- **Persistence Layer** ([db.py](file:///c:/Users/sreet/Downloads/TOC%20ProJECT/backend/db.py)):
  - SQLite database (`railway_database.sqlite`) for saving and reloading custom railway networks and verification audit logs.
- **Flask REST API** ([app.py](file:///c:/Users/sreet/Downloads/TOC%20ProJECT/backend/app.py)):
  - Complete REST endpoints for CRUD operations on stations and transitions, route verification, BFS shortest path, consistency checks, and network serialization.
- **Automated Pytest Suite** ([test_automata.py](file:///c:/Users/sreet/Downloads/TOC%20ProJECT/backend/tests/test_automata.py)):
  - 8/8 test cases covering proposal scenarios, branchings, dead ends, reachability, and edge cases.

### Frontend (`/frontend`)
- **Vite + React Interactive Web Application**:
  - **State Graph Canvas** ([RailwayGraph.jsx](file:///c:/Users/sreet/Downloads/TOC%20ProJECT/frontend/src/components/RailwayGraph.jsx)): Interactive SVG automata diagram with draggable nodes, pan/zoom, accepting state double-rings, failure glow, and animated journey traversal lines.
  - **Journey Verifier** ([RouteVerifier.jsx](file:///c:/Users/sreet/Downloads/TOC%20ProJECT/frontend/src/components/RouteVerifier.jsx)): Interactive input with TOC proposal demo presets, failure reason badges, celebration confetti on acceptance, and BFS shortest path finder.
  - **Network Builder** ([NetworkBuilder.jsx](file:///c:/Users/sreet/Downloads/TOC%20ProJECT/frontend/src/components/NetworkBuilder.jsx)): Add/delete stations, designate $q_0$ and $F$, and connect tracks with custom train type permissions.
  - **Audit & Reports** ([AnalysisReportDrawer.jsx](file:///c:/Users/sreet/Downloads/TOC%20ProJECT/frontend/src/components/AnalysisReportDrawer.jsx)): Real-time structural consistency audit and JSON report export.

---

## 3. Running the Project

### Start Backend Server:
```powershell
python -m backend.app
# Runs at http://127.0.0.1:5000
```

### Start Frontend Dev Server:
```powershell
cd frontend
npm run dev
# Runs at http://localhost:5173
```

### Run Unit Tests:
```powershell
python -m pytest backend/tests/
```
