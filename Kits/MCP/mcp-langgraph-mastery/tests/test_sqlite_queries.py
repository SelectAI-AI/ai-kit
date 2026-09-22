from src.tools.db_utils import initialize_app_db, list_tables, query_table


def test_initialize_and_query_sqlite(tmp_path):
    db_path = tmp_path / "app_data.db"
    initialize_app_db(db_path)
    tables = list_tables(db_path)
    assert "customers" in tables
    assert "orders" in tables
    rows = query_table(db_path, "customers", limit=2)
    assert len(rows) == 2
    assert all("name" in row for row in rows)
