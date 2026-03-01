"""Async client for Monarch Money API via monarchmoneycommunity.

Wraps the community library with:
  - Session persistence (login once, reuse token)
  - Schema-validated DataFrames for all data types
  - Parquet export for local data lake storage
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pandas as pd
from monarchmoney import MonarchMoney

from money_talks.schemas.transactions import ensure_transaction_schema
from money_talks.schemas.accounts import ensure_account_schema


class MonarchClient:
    """High-level async client for pulling Monarch Money data."""

    def __init__(self, session_file: str | Path | None = None) -> None:
        self._mm = MonarchMoney()
        self._session_file = Path(session_file) if session_file else None
        self._authenticated = False

    async def login_interactive(self) -> None:
        """Interactive login with MFA support (for CLI/Jupyter use)."""
        await self._mm.interactive_login()
        self._authenticated = True
        if self._session_file:
            self._mm.save_session(str(self._session_file))

    async def login(self, email: str, password: str, mfa_secret_key: str | None = None) -> None:
        """Programmatic login."""
        await self._mm.login(email, password, mfa_secret_key=mfa_secret_key)
        self._authenticated = True
        if self._session_file:
            self._mm.save_session(str(self._session_file))

    def load_session(self) -> None:
        """Load a previously saved session token."""
        if self._session_file and self._session_file.exists():
            self._mm.load_session(str(self._session_file))
            self._authenticated = True
        else:
            raise FileNotFoundError(
                f"No session file at {self._session_file}. Run login_interactive() first."
            )

    def _require_auth(self) -> None:
        if not self._authenticated:
            raise RuntimeError("Not authenticated. Call login_interactive() or load_session().")

    # ── Data Extraction ────────────────────────────────────────────────────

    async def get_transactions(self, limit: int = 5000) -> pd.DataFrame:
        """Fetch transactions as a schema-validated DataFrame."""
        self._require_auth()
        raw = await self._mm.get_transactions(limit=limit)
        records = _extract_transaction_records(raw)
        df = pd.DataFrame(records)
        return ensure_transaction_schema(df)

    async def get_accounts(self) -> pd.DataFrame:
        """Fetch all linked accounts as a schema-validated DataFrame."""
        self._require_auth()
        raw = await self._mm.get_accounts()
        records = _extract_account_records(raw)
        df = pd.DataFrame(records)
        return ensure_account_schema(df)

    async def get_cashflow(self) -> dict[str, Any]:
        """Fetch cashflow summary (raw dict, varies by time range)."""
        self._require_auth()
        return await self._mm.get_cashflow()

    async def get_budgets(self) -> dict[str, Any]:
        """Fetch budget data (raw dict)."""
        self._require_auth()
        return await self._mm.get_budgets()

    async def get_recurring_transactions(self) -> dict[str, Any]:
        """Fetch recurring transaction patterns."""
        self._require_auth()
        return await self._mm.get_recurring_transactions()

    async def get_account_holdings(self) -> dict[str, Any]:
        """Fetch investment holdings across accounts."""
        self._require_auth()
        return await self._mm.get_account_holdings()

    # ── Export ─────────────────────────────────────────────────────────────

    async def export_all(self, output_dir: str | Path) -> dict[str, Path]:
        """Pull all data and write to parquet files in output_dir.

        Returns a dict mapping table name → file path.
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        transactions = await self.get_transactions()
        accounts = await self.get_accounts()

        paths: dict[str, Path] = {}

        txn_path = output_dir / "transactions.parquet"
        transactions.to_parquet(txn_path, index=False)
        paths["transactions"] = txn_path

        acct_path = output_dir / "accounts.parquet"
        accounts.to_parquet(acct_path, index=False)
        paths["accounts"] = acct_path

        return paths


# ── Helpers ────────────────────────────────────────────────────────────────


def _extract_transaction_records(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten the Monarch GraphQL response into flat dicts."""
    transactions = raw.get("allTransactions", {}).get("results", [])
    records = []
    for txn in transactions:
        category = txn.get("category", {}) or {}
        account = txn.get("account", {}) or {}
        records.append(
            {
                "id": txn.get("id"),
                "date": txn.get("date"),
                "merchant": txn.get("merchant", {}).get("name") if txn.get("merchant") else None,
                "original_name": txn.get("originalName"),
                "category": category.get("name"),
                "category_group": category.get("group", {}).get("name")
                if category.get("group")
                else None,
                "account": account.get("displayName"),
                "account_type": account.get("type", {}).get("display")
                if account.get("type")
                else None,
                "amount": txn.get("amount"),
                "notes": txn.get("notes"),
                "tags": ", ".join(t.get("name", "") for t in (txn.get("tags") or [])),
                "is_recurring": txn.get("isRecurring", False),
                "is_pending": txn.get("pending", False),
            }
        )
    return records


def _extract_account_records(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten the Monarch account response."""
    accounts = raw.get("accounts", [])
    records = []
    for acct in accounts:
        acct_type = acct.get("type", {}) or {}
        records.append(
            {
                "id": acct.get("id"),
                "name": acct.get("displayName"),
                "institution": acct.get("institution", {}).get("name")
                if acct.get("institution")
                else None,
                "type": acct_type.get("display"),
                "subtype": acct.get("subtype", {}).get("display")
                if acct.get("subtype")
                else None,
                "balance": acct.get("currentBalance"),
                "is_active": acct.get("isActive", True),
                "is_manual": acct.get("isManual", False),
            }
        )
    return records
