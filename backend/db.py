"""
Persistence layer for Railway Automaton Networks using SQLite.
Stores network configurations, stations, transitions, and saved verification reports.
"""

import sqlite3
import json
import os
from typing import List, Dict, Any, Optional

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "railway_database.sqlite")


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Networks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS networks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Verification reports history table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network_id TEXT,
        train_type TEXT,
        proposed_route TEXT,
        status TEXT,
        report_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()


def save_network_to_db(network_id: str, name: str, network_dict: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO networks (id, name, data_json, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        data_json=excluded.data_json,
        updated_at=CURRENT_TIMESTAMP;
    """, (network_id, name, json.dumps(network_dict)))
    conn.commit()
    conn.close()


def get_network_from_db(network_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT data_json FROM networks WHERE id = ?", (network_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row["data_json"])
    return None


def list_networks_from_db() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, created_at, updated_at FROM networks ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r["id"], "name": r["name"], "created_at": r["created_at"], "updated_at": r["updated_at"]} for r in rows]


def delete_network_from_db(network_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM networks WHERE id = ?", (network_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def save_report_to_db(network_id: str, train_type: str, route: List[str], status: str, report: Dict[str, Any]) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO reports (network_id, train_type, proposed_route, status, report_json)
    VALUES (?, ?, ?, ?, ?)
    """, (network_id, train_type, " -> ".join(route), status, json.dumps(report)))
    report_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return report_id


def list_reports_from_db(limit: int = 20) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, network_id, train_type, proposed_route, status, created_at
    FROM reports ORDER BY id DESC LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "network_id": r["network_id"],
            "train_type": r["train_type"],
            "proposed_route": r["proposed_route"],
            "status": r["status"],
            "created_at": r["created_at"]
        }
        for r in rows
    ]
