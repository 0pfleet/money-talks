"""Account schema definition and coercion."""

from __future__ import annotations

from typing import TypedDict

import pandas as pd


class AccountRecord(TypedDict, total=False):
    """A single Monarch Money account."""

    id: str
    name: str
    institution: str
    type: str  # checking, savings, credit_card, investment, loan, etc.
    subtype: str
    balance: float
    currency: str
    is_active: bool
    is_manual: bool
    last_synced: str  # ISO 8601 datetime


ACCOUNT_SCHEMA: dict[str, str] = {
    "id": "string",
    "name": "string",
    "institution": "string",
    "type": "string",
    "subtype": "string",
    "balance": "float64",
    "currency": "string",
    "is_active": "boolean",
    "is_manual": "boolean",
    "last_synced": "string",
}


def ensure_account_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce a DataFrame to match the account schema."""
    for col, dtype in ACCOUNT_SCHEMA.items():
        if col not in df.columns:
            df[col] = pd.NA
        df[col] = df[col].astype(dtype, errors="ignore")

    return df[[c for c in ACCOUNT_SCHEMA if c in df.columns]]
