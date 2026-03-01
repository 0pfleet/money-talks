"""Local data lake utilities for parquet storage and DuckDB queries."""

from money_talks.lake.storage import write_parquet_atomic, load_table
from money_talks.lake.queries import create_duckdb_connection

__all__ = ["write_parquet_atomic", "load_table", "create_duckdb_connection"]
