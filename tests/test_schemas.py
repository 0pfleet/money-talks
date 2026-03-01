"""Tests for schema enforcement."""

import pandas as pd

from money_talks.schemas.transactions import TRANSACTION_SCHEMA, ensure_transaction_schema
from money_talks.schemas.accounts import ACCOUNT_SCHEMA, ensure_account_schema


def test_ensure_transaction_schema_adds_missing_columns():
    """Missing columns should be added with NA values."""
    df = pd.DataFrame({"date": ["2026-01-15"], "amount": [-42.50]})
    result = ensure_transaction_schema(df)

    assert "merchant" in result.columns
    assert "category" in result.columns
    assert len(result) == 1


def test_ensure_transaction_schema_drops_extra_columns():
    """Columns not in the schema should be dropped."""
    df = pd.DataFrame({
        "date": ["2026-01-15"],
        "amount": [-42.50],
        "extra_column": ["should be dropped"],
    })
    result = ensure_transaction_schema(df)

    assert "extra_column" not in result.columns


def test_ensure_account_schema_coerces_types():
    """Balance should be coerced to float64."""
    df = pd.DataFrame({
        "name": ["Checking"],
        "balance": ["1234.56"],  # string input
    })
    result = ensure_account_schema(df)

    assert result["balance"].dtype == "float64"
    assert result["balance"].iloc[0] == 1234.56
