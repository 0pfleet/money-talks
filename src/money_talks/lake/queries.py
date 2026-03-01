"""DuckDB query helpers for the local data lake.

DuckDB can query parquet files directly without loading into memory,
making it ideal for SQL-based analysis over the local data lake.
"""

from __future__ import annotations

from pathlib import Path

import duckdb


def create_duckdb_connection(lake_dir: str | Path) -> duckdb.DuckDBPyConnection:
    """Create a DuckDB connection with views over all parquet tables.

    Scans lake_dir for .parquet files and creates a view for each one,
    so you can immediately run SQL like: SELECT * FROM transactions WHERE ...

    Args:
        lake_dir: Directory containing parquet files (e.g., transactions.parquet).

    Returns:
        DuckDB connection with views registered.
    """
    lake_dir = Path(lake_dir)
    conn = duckdb.connect()

    for parquet_file in lake_dir.glob("*.parquet"):
        table_name = parquet_file.stem  # e.g., "transactions" from "transactions.parquet"
        conn.execute(
            f"CREATE VIEW {table_name} AS SELECT * FROM read_parquet('{parquet_file}')"
        )

    return conn
