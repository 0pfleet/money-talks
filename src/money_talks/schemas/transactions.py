"""Transaction schema definition and coercion.

Define expected columns with types, then coerce loaded data to match
(add missing cols, drop extras, cast types).
"""

from __future__ import annotations

from typing import TypedDict

import pandas as pd

# ── Schema Definition ──────────────────────────────────────────────────────

class TransactionRecord(TypedDict, total=False):
    """A single Monarch Money transaction."""

    id: str
    date: str  # ISO 8601 date
    merchant: str
    original_name: str  # raw merchant string before Monarch cleanup
    category: str
    category_group: str
    account: str
    account_type: str  # checking, savings, credit_card, investment, etc.
    amount: float  # negative = expense, positive = income
    currency: str
    notes: str
    tags: str  # comma-separated tag list
    is_recurring: bool
    is_pending: bool
    is_split: bool
    has_attachments: bool


# Column name → pandas dtype for coercion
TRANSACTION_SCHEMA: dict[str, str] = {
    "id": "string",
    "date": "string",
    "merchant": "string",
    "original_name": "string",
    "category": "string",
    "category_group": "string",
    "account": "string",
    "account_type": "string",
    "amount": "float64",
    "currency": "string",
    "notes": "string",
    "tags": "string",
    "is_recurring": "boolean",
    "is_pending": "boolean",
    "is_split": "boolean",
    "has_attachments": "boolean",
}


# ── Schema Enforcement ─────────────────────────────────────────────────────

def ensure_transaction_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce a DataFrame to match the transaction schema.

    - Adds missing columns with None/NaN defaults
    - Casts columns to expected types
    - Drops columns not in the schema
    """
    for col, dtype in TRANSACTION_SCHEMA.items():
        if col not in df.columns:
            df[col] = pd.NA
        df[col] = df[col].astype(dtype, errors="ignore")

    return df[[c for c in TRANSACTION_SCHEMA if c in df.columns]]
