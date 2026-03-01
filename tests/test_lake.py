"""Tests for the local data lake (storage + DuckDB queries)."""

from pathlib import Path

import pandas as pd

from money_talks.lake.storage import write_parquet_atomic, load_table
from money_talks.lake.queries import create_duckdb_connection


def test_write_and_load_parquet(tmp_path: Path):
    """Round-trip: write parquet, load it back."""
    df = pd.DataFrame({
        "merchant": ["Coffee Shop", "Gas Station"],
        "amount": [-4.50, -38.00],
    })

    path = write_parquet_atomic(df, tmp_path / "test.parquet")
    assert path.exists()

    loaded = load_table(path)
    assert len(loaded) == 2
    assert loaded["amount"].sum() == -42.50


def test_duckdb_creates_views(tmp_path: Path):
    """DuckDB connection should auto-create views from parquet files."""
    df = pd.DataFrame({
        "category": ["Groceries", "Gas", "Groceries"],
        "amount": [-45.0, -38.0, -62.0],
    })
    df.to_parquet(tmp_path / "transactions.parquet", index=False)

    conn = create_duckdb_connection(tmp_path)
    result = conn.execute(
        "SELECT category, SUM(amount) as total FROM transactions GROUP BY 1 ORDER BY total"
    ).fetchdf()

    assert len(result) == 2
    assert result.iloc[0]["category"] == "Groceries"
