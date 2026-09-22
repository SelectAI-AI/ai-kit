from __future__ import annotations

from pathlib import Path

from mcp.server.fastmcp import FastMCP

from src.tools.db_utils import DEFAULT_DB_PATH, database_overview, initialize_app_db, list_tables, query_sqlite, query_table

DB_PATH = initialize_app_db(DEFAULT_DB_PATH)
mcp = FastMCP("guided-lab-sqlite", json_response=True)


@mcp.resource("sqlite://overview")
def sqlite_overview() -> dict:
    """Return schema and table information for the demo SQLite database."""
    return database_overview(DB_PATH)


@mcp.resource("sqlite://table/{table}")
def sqlite_table_resource(table: str) -> list[dict]:
    """Expose a table as a readable resource."""
    return query_table(DB_PATH, table=table, limit=25)


@mcp.tool()
def sqlite_list_tables() -> list[str]:
    """List tables available in the SQLite database."""
    return list_tables(DB_PATH)


@mcp.tool()
def sqlite_query_table(table: str, limit: int = 10) -> list[dict]:
    """Query a specific SQLite table safely."""
    return query_table(DB_PATH, table=table, limit=limit)


@mcp.tool()
def sqlite_run_select(query: str) -> list[dict]:
    """Run a read-only SQL query."""
    return query_sqlite(DB_PATH, query=query)


@mcp.prompt()
def sql_prompt(question: str, schema_hint: str = "") -> str:
    """Convert a natural-language database question into a structured query plan."""
    hint = f" Schema hint: {schema_hint}" if schema_hint else ""
    return (
        f"Answer the database question step by step: {question}.{hint} "
        "Return: intent, tables, candidate SQL, and a short validation note."
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
