"""Cashflow and budget schema definitions."""

from __future__ import annotations

from typing import TypedDict

import pandas as pd


class CashflowRecord(TypedDict, total=False):
    """Monthly cashflow summary."""

    month: str  # YYYY-MM
    income: float
    expenses: float
    savings: float
    savings_rate: float  # 0.0 - 1.0


class BudgetRecord(TypedDict, total=False):
    """Budget line item."""

    category: str
    category_group: str
    budgeted: float
    actual: float
    remaining: float
    month: str  # YYYY-MM


CASHFLOW_SCHEMA: dict[str, str] = {
    "month": "string",
    "income": "float64",
    "expenses": "float64",
    "savings": "float64",
    "savings_rate": "float64",
}

BUDGET_SCHEMA: dict[str, str] = {
    "category": "string",
    "category_group": "string",
    "budgeted": "float64",
    "actual": "float64",
    "remaining": "float64",
    "month": "string",
}


def ensure_cashflow_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce a DataFrame to match the cashflow schema."""
    for col, dtype in CASHFLOW_SCHEMA.items():
        if col not in df.columns:
            df[col] = pd.NA
        df[col] = df[col].astype(dtype, errors="ignore")
    return df[[c for c in CASHFLOW_SCHEMA if c in df.columns]]


def ensure_budget_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce a DataFrame to match the budget schema."""
    for col, dtype in BUDGET_SCHEMA.items():
        if col not in df.columns:
            df[col] = pd.NA
        df[col] = df[col].astype(dtype, errors="ignore")
    return df[[c for c in BUDGET_SCHEMA if c in df.columns]]
