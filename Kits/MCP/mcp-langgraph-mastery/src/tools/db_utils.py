from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = BASE_DIR / "data" / "app_data.db"


SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    tier TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS lab_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    summary TEXT NOT NULL
);
"""

SEED_CUSTOMERS = [
    ("Anu", "Chennai", "gold"),
    ("Ravi", "Bengaluru", "silver"),
    ("Meera", "Mumbai", "gold"),
    ("Kiran", "Hyderabad", "bronze"),
]

SEED_ORDERS = [
    (1, "Notebook", 1500.0, "paid"),
    (1, "Keyboard", 2200.0, "paid"),
    (2, "Mouse", 900.0, "pending"),
    (3, "Monitor", 12000.0, "paid"),
    (4, "USB-C Hub", 1800.0, "paid"),
]

SEED_NOTES = [
    ("MCP Core Concepts", "Host/client/server separation, transports, resources, tools, and prompts."),
    ("LangGraph Fundamentals", "StateGraph, conditional edges, compile, invoke, and persistence."),
    ("Human-in-the-loop", "interrupt_before and interrupt support approval workflows."),
    ("Multi-server agent", "MultiServerMCPClient can collect tools from multiple MCP servers."),
]


def connect(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn


def initialize_app_db(db_path: str | Path = DEFAULT_DB_PATH) -> Path:
    path = Path(db_path)
    with connect(path) as conn:
        conn.executescript(SCHEMA_SQL)
        if conn.execute("SELECT COUNT(*) AS c FROM customers").fetchone()["c"] == 0:
            conn.executemany("INSERT INTO customers(name, city, tier) VALUES (?, ?, ?)", SEED_CUSTOMERS)
        if conn.execute("SELECT COUNT(*) AS c FROM orders").fetchone()["c"] == 0:
            conn.executemany(
                "INSERT INTO orders(customer_id, item, amount, status) VALUES (?, ?, ?, ?)",
                SEED_ORDERS,
            )
        if conn.execute("SELECT COUNT(*) AS c FROM lab_notes").fetchone()["c"] == 0:
            conn.executemany(
                "INSERT INTO lab_notes(topic, summary) VALUES (?, ?)",
                SEED_NOTES,
            )
        conn.commit()
    return path


def list_tables(db_path: str | Path = DEFAULT_DB_PATH) -> list[str]:
    with connect(db_path) as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
    return [row["name"] for row in rows]


def describe_table(db_path: str | Path, table: str) -> list[dict[str, Any]]:
    with connect(db_path) as conn:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return [dict(row) for row in rows]


def query_sqlite(db_path: str | Path, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    query_clean = query.strip().rstrip(";")
    if not query_clean.lower().startswith(("select", "with", "pragma")):
        raise ValueError("Only read-only queries are allowed in this guided lab.")
    with connect(db_path) as conn:
        rows = conn.execute(query_clean, params).fetchall()
    return [dict(row) for row in rows]


def query_table(db_path: str | Path, table: str, limit: int = 10) -> list[dict[str, Any]]:
    if table not in {"customers", "orders", "lab_notes"}:
        raise ValueError(f"Unknown table: {table}")
    return query_sqlite(db_path, f"SELECT * FROM {table} LIMIT ?", (limit,))


def database_overview(db_path: str | Path = DEFAULT_DB_PATH) -> dict[str, Any]:
    return {
        "path": str(Path(db_path)),
        "tables": {
            table: describe_table(db_path, table)
            for table in list_tables(db_path)
        },
    }


def rows_from_summary(summary: str, source: str = "agent") -> list[dict[str, str]]:
    lines = [line.strip() for line in summary.splitlines() if line.strip()]
    rows = []
    for i, line in enumerate(lines, start=1):
        rows.append({"source": source, "line_no": str(i), "content": line})
    return rows
