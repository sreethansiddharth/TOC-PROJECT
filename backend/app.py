"""
Flask REST API for Smart Railway Route Verifier.
Exposes endpoints for:
- Station & track management
- Network serialization, save & reload
- Route validation
- BFS shortest path computation
- Dead-end & reachability detection
- Consistency checks
- Report generation & export
"""

import os
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from .automata.railway_automaton import RailwayAutomaton
from .db import (
    init_db,
    save_network_to_db,
    get_network_from_db,
    list_networks_from_db,
    delete_network_from_db,
    save_report_to_db,
    list_reports_from_db
)

app = Flask(__name__)
CORS(app)

# Initialize persistence
init_db()

# Active in-memory automaton instance
active_network = RailwayAutomaton(name="Metropolitan Central Railway")

# Preload with proposal scenario and realistic multi-line network
def populate_default_network():
    active_network.set_start_station("Central Station")
    active_network.set_accepting_stations(["Westfield Terminal", "Harbor Port", "North Bay"])

    active_network.station_metadata = {
        "Central Station": {"x": 100, "y": 250, "label": "Central Station (Hub)"},
        "Bridgeview": {"x": 260, "y": 200, "label": "Bridgeview Junction"},
        "Midtown Junction": {"x": 420, "y": 140, "label": "Midtown Transfer"},
        "Westfield Terminal": {"x": 620, "y": 120, "label": "Westfield Terminal"},
        "East Park": {"x": 260, "y": 340, "label": "East Park Suburb"},
        "Harbor Port": {"x": 460, "y": 380, "label": "Harbor Freight Terminal"},
        "Old Depot (Dead End)": {"x": 420, "y": 250, "label": "Old Freight Depot"},
        "North Bay": {"x": 620, "y": 260, "label": "North Bay Coastal"}
    }

    # Add all stations
    for s, meta in active_network.station_metadata.items():
        is_start = (s == "Central Station")
        is_acc = (s in ["Westfield Terminal", "Harbor Port", "North Bay"])
        active_network.add_station(s, is_start=is_start, is_accepting=is_acc, **meta)

    # Add transitions with train types: Express, Local, Freight, HighSpeed
    active_network.add_transition("Central Station", "Bridgeview", ["Express", "Local", "HighSpeed"])
    active_network.add_transition("Bridgeview", "Midtown Junction", ["Express", "HighSpeed"])
    active_network.add_transition("Bridgeview", "Old Depot (Dead End)", ["Freight"])
    active_network.add_transition("Midtown Junction", "Westfield Terminal", ["Express", "HighSpeed"])
    active_network.add_transition("Midtown Junction", "North Bay", ["Local", "Express"])
    active_network.add_transition("Central Station", "East Park", ["Local"])
    active_network.add_transition("East Park", "Harbor Port", ["Local", "Freight"])
    active_network.add_transition("Bridgeview", "Harbor Port", ["Freight"])

    # Save default to database
    save_network_to_db("default-metro", active_network.name, active_network.to_dict())

populate_default_network()


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "Smart Railway Route Verifier API"})


@app.route("/api/network", methods=["GET"])
def get_current_network():
    """Retrieve the current active railway network graph."""
    return jsonify({
        "network": active_network.to_dict(),
        "summary": {
            "stations_count": len(active_network.stations),
            "start_station": active_network.start_station,
            "accepting_stations": list(active_network.accepting_stations),
            "available_train_types": ["Express", "Local", "Freight", "HighSpeed"]
        }
    })


@app.route("/api/network/reset-default", methods=["POST"])
def reset_to_default():
    """Reset to initial showcase network."""
    global active_network
    active_network = RailwayAutomaton(name="Metropolitan Central Railway")
    populate_default_network()
    return jsonify({"message": "Network reset to default demo scenario", "network": active_network.to_dict()})


@app.route("/api/network/station", methods=["POST"])
def add_station():
    """Add a new station."""
    data = request.json or {}
    name = data.get("name")
    if not name:
        return jsonify({"error": "Station name is required"}), 400

    is_start = data.get("is_start", False)
    is_accepting = data.get("is_accepting", False)
    x = data.get("x")
    y = data.get("y")
    label = data.get("label", name)

    active_network.add_station(name, is_start=is_start, is_accepting=is_accepting, x=x, y=y, label=label)
    return jsonify({"message": f"Station '{name}' added", "network": active_network.to_dict()})


@app.route("/api/network/station/<station_name>", methods=["DELETE"])
def delete_station(station_name):
    """Delete station and all connected transitions."""
    active_network.remove_station(station_name)
    return jsonify({"message": f"Station '{station_name}' deleted", "network": active_network.to_dict()})


@app.route("/api/network/transition", methods=["POST"])
def add_transition():
    """Add or update a track transition."""
    data = request.json or {}
    source = data.get("source")
    target = data.get("target")
    train_types = data.get("train_types", [])

    if not source or not target:
        return jsonify({"error": "Source and target station required"}), 400
    if not train_types:
        return jsonify({"error": "At least one permitted train type is required"}), 400

    active_network.add_transition(source, target, train_types)
    return jsonify({"message": "Transition created/updated", "network": active_network.to_dict()})


@app.route("/api/network/transition", methods=["DELETE"])
def remove_transition():
    """Delete a track transition."""
    data = request.json or {}
    source = data.get("source")
    target = data.get("target")
    train_type = data.get("train_type")

    if not source or not target:
        return jsonify({"error": "Source and target station required"}), 400

    active_network.remove_transition(source, target, train_type)
    return jsonify({"message": "Transition removed", "network": active_network.to_dict()})


@app.route("/api/network/set-start", methods=["POST"])
def set_start():
    data = request.json or {}
    station = data.get("station")
    active_network.set_start_station(station)
    return jsonify({"message": f"Start station set to {station}", "start_station": active_network.start_station})


@app.route("/api/network/set-accepting", methods=["POST"])
def set_accepting():
    data = request.json or {}
    stations = data.get("stations", [])
    active_network.set_accepting_stations(stations)
    return jsonify({"message": "Accepting stations updated", "accepting_stations": list(active_network.accepting_stations)})


@app.route("/api/verify-route", methods=["POST"])
def verify_route():
    """
    Automata Route Validation Endpoint.
    Payload: { "route": ["A", "B", "C"], "train_type": "Express" }
    """
    data = request.json or {}
    route = data.get("route", [])
    train_type = data.get("train_type", "Express")

    result = active_network.validate_route(route, train_type)
    return jsonify(result)


@app.route("/api/shortest-path", methods=["POST"])
def shortest_path():
    """
    BFS Shortest Accepted Path Finder Endpoint.
    Payload: { "source": "A", "destination": "D", "train_type": "Express" }
    """
    data = request.json or {}
    source = data.get("source")
    destination = data.get("destination")
    train_type = data.get("train_type", "Express")

    if not source or not destination:
        return jsonify({"error": "Source and destination are required"}), 400

    result = active_network.find_shortest_path(source, destination, train_type)
    return jsonify(result)


@app.route("/api/analysis/dead-ends", methods=["GET"])
def get_dead_ends():
    train_type = request.args.get("train_type", "Express")
    dead_ends = active_network.find_dead_ends(train_type)
    return jsonify({"train_type": train_type, "dead_end_stations": dead_ends})


@app.route("/api/analysis/consistency", methods=["GET"])
def get_consistency():
    train_type = request.args.get("train_type")
    consistency = active_network.check_network_consistency(train_type)
    return jsonify(consistency)


@app.route("/api/report/generate", methods=["POST"])
def generate_report():
    data = request.json or {}
    route = data.get("route", [])
    train_type = data.get("train_type", "Express")
    network_id = data.get("network_id", "active")

    report = active_network.generate_report(route, train_type)
    status = report["status"]

    # Save to history
    report_id = save_report_to_db(network_id, train_type, route, status, report)
    report["report_id"] = report_id

    return jsonify(report)


@app.route("/api/reports/history", methods=["GET"])
def get_reports_history():
    history = list_reports_from_db()
    return jsonify(history)


@app.route("/api/networks/save", methods=["POST"])
def save_network():
    data = request.json or {}
    network_id = data.get("id")
    name = data.get("name", "Custom Network")
    net_dict = data.get("network") or active_network.to_dict()

    if not network_id:
        import uuid
        network_id = str(uuid.uuid4())[:8]

    save_network_to_db(network_id, name, net_dict)
    return jsonify({"message": f"Network '{name}' saved successfully", "id": network_id})


@app.route("/api/networks/list", methods=["GET"])
def list_saved_networks():
    networks = list_networks_from_db()
    return jsonify(networks)


@app.route("/api/networks/load/<network_id>", methods=["POST"])
def load_saved_network(network_id):
    global active_network
    data = get_network_from_db(network_id)
    if not data:
        return jsonify({"error": "Saved network not found"}), 404

    active_network = RailwayAutomaton.from_dict(data)
    return jsonify({"message": f"Loaded network '{active_network.name}'", "network": active_network.to_dict()})


@app.route("/api/networks/<network_id>", methods=["DELETE"])
def delete_saved_network(network_id):
    success = delete_network_from_db(network_id)
    if not success:
        return jsonify({"error": "Network not found"}), 404
    return jsonify({"message": "Network deleted"})


if __name__ == "__main__":
    app.run(port=5000, debug=True)
