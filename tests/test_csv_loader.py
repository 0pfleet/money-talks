"""Tests for CSV import from Monarch Money exports."""

import tempfile
from pathlib import Path

import pandas as pd
import pytest

from money_talks.ingest.csv_loader import load_transactions_csv


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    """Create a sample Monarch Money CSV export."""
    csv_path = tmp_path / "transactions.csv"
    csv_path.write_text(
        "Date,Merchant,Category,Category Group,Account,Account Type,Original Statement,Notes,Amount,Tags\n"
        "2026-01-15,Trader Joe's,Groceries,Food & Drink,Chase Checking,Checking,TRADER JOE'S #123,,−45.67,\n"
        "2026-01-14,Shell,Gas,Transportation,Chase Checking,Checking,SHELL OIL,,−38.50,commute\n"
        "2026-01-13,Acme Corp,Income,Income,Chase Checking,Checking,ACME CORP PAYROLL,,3200.00,\n"
    )
    return csv_path


def test_load_csv_returns_dataframe(sample_csv: Path):
    df = load_transactions_csv(sample_csv)
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 3


def test_load_csv_normalizes_columns(sample_csv: Path):
    df = load_transactions_csv(sample_csv)
    assert "merchant" in df.columns
    assert "category_group" in df.columns
    assert "original_name" in df.columns
    # Original CSV column names should not be present
    assert "Merchant" not in df.columns


def test_load_csv_generates_ids(sample_csv: Path):
    df = load_transactions_csv(sample_csv)
    assert "id" in df.columns
    assert df["id"].iloc[0] == "csv-0"


def test_load_csv_file_not_found():
    with pytest.raises(FileNotFoundError):
        load_transactions_csv("/nonexistent/path.csv")
