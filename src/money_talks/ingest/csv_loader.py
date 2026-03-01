"""Load and normalize Monarch Money CSV exports.

Monarch's web UI exports transactions as CSV with columns like:
  Date, Merchant, Category, Account, Original Statement, Notes, Amount, Tags

This module loads that CSV and normalizes it to our internal schema.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from money_talks.schemas.transactions import TRANSACTION_SCHEMA, ensure_transaction_schema


# Mapping from Monarch CSV column names → our internal schema names
_CSV_COLUMN_MAP: dict[str, str] = {
    "Date": "date",
    "Merchant": "merchant",
    "Category": "category",
    "Category Group": "category_group",
    "Account": "account",
    "Account Type": "account_type",
    "Original Statement": "original_name",
    "Notes": "notes",
    "Amount": "amount",
    "Tags": "tags",
}


def load_transactions_csv(path: str | Path) -> pd.DataFrame:
    """Load a Monarch Money transaction CSV export.

    Args:
        path: Path to the CSV file exported from Monarch Money.

    Returns:
        DataFrame conforming to TRANSACTION_SCHEMA.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {path}")

    raw = pd.read_csv(path, dtype=str)

    # Normalize column names
    df = raw.rename(columns=_CSV_COLUMN_MAP)

    # Parse amount as float
    if "amount" in df.columns:
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce")

    # Generate deterministic IDs if none exist
    if "id" not in df.columns:
        df["id"] = [f"csv-{i}" for i in range(len(df))]

    return ensure_transaction_schema(df)
