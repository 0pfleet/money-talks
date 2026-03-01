"""Generate realistic synthetic financial data for testing.

Creates transactions.parquet and accounts.parquet in the default
data lake location (~/.money-talks/lake/).

Usage:
    python scripts/generate_sample_data.py
    python scripts/generate_sample_data.py --output-dir /path/to/lake
"""

from __future__ import annotations

import argparse
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

DEFAULT_LAKE_DIR = Path.home() / ".money-talks" / "lake"

# ── Merchants & Categories ─────────────────────────────────────────────────

EXPENSE_MERCHANTS: list[dict[str, str | tuple[float, float]]] = [
    {"merchant": "Trader Joe's", "category": "Groceries", "group": "Food & Drink", "range": (25, 120)},
    {"merchant": "Whole Foods", "category": "Groceries", "group": "Food & Drink", "range": (30, 150)},
    {"merchant": "Costco", "category": "Groceries", "group": "Food & Drink", "range": (80, 250)},
    {"merchant": "DoorDash", "category": "Restaurants", "group": "Food & Drink", "range": (15, 55)},
    {"merchant": "Chipotle", "category": "Restaurants", "group": "Food & Drink", "range": (10, 25)},
    {"merchant": "Starbucks", "category": "Coffee Shops", "group": "Food & Drink", "range": (4, 12)},
    {"merchant": "Shell", "category": "Gas", "group": "Transportation", "range": (30, 65)},
    {"merchant": "Uber", "category": "Ride Share", "group": "Transportation", "range": (12, 45)},
    {"merchant": "Amazon", "category": "Shopping", "group": "Shopping", "range": (10, 200)},
    {"merchant": "Target", "category": "Shopping", "group": "Shopping", "range": (15, 120)},
    {"merchant": "Netflix", "category": "Subscriptions", "group": "Entertainment", "range": (15.49, 15.49)},
    {"merchant": "Spotify", "category": "Subscriptions", "group": "Entertainment", "range": (10.99, 10.99)},
    {"merchant": "Hulu", "category": "Subscriptions", "group": "Entertainment", "range": (17.99, 17.99)},
    {"merchant": "YouTube Premium", "category": "Subscriptions", "group": "Entertainment", "range": (13.99, 13.99)},
    {"merchant": "Planet Fitness", "category": "Gym", "group": "Health & Fitness", "range": (24.99, 24.99)},
    {"merchant": "CVS Pharmacy", "category": "Pharmacy", "group": "Health & Fitness", "range": (8, 60)},
    {"merchant": "Pacific Gas & Electric", "category": "Utilities", "group": "Bills", "range": (80, 180)},
    {"merchant": "Comcast", "category": "Internet", "group": "Bills", "range": (79.99, 79.99)},
    {"merchant": "T-Mobile", "category": "Phone", "group": "Bills", "range": (85, 85)},
    {"merchant": "State Farm", "category": "Insurance", "group": "Bills", "range": (145, 145)},
    {"merchant": "Landlord - Rent", "category": "Rent", "group": "Housing", "range": (2200, 2200)},
]

INCOME_SOURCES = [
    {"merchant": "Acme Corp", "category": "Salary", "group": "Income", "amount": 4800},
    {"merchant": "Acme Corp", "category": "Salary", "group": "Income", "amount": 4800},
]

ACCOUNTS = [
    {"name": "Chase Checking", "institution": "Chase", "type": "Checking", "balance": 5420.33},
    {"name": "Chase Savings", "institution": "Chase", "type": "Savings", "balance": 12800.00},
    {"name": "Sapphire Reserve", "institution": "Chase", "type": "Credit Card", "balance": -2340.67},
    {"name": "Fidelity 401k", "institution": "Fidelity", "type": "Investment", "balance": 45200.00},
    {"name": "Robinhood", "institution": "Robinhood", "type": "Investment", "balance": 8750.00},
]


def generate_transactions(months: int = 6) -> pd.DataFrame:
    """Generate synthetic transactions for the last N months."""
    random.seed(42)
    records = []
    today = date.today()
    start_date = today.replace(day=1) - timedelta(days=months * 30)

    txn_id = 0
    current = start_date

    while current <= today:
        # ── Income (1st and 15th of each month) ────────────────────
        if current.day in (1, 15):
            for src in INCOME_SOURCES:
                txn_id += 1
                records.append({
                    "id": f"txn-{txn_id}",
                    "date": current.isoformat(),
                    "merchant": src["merchant"],
                    "original_name": "ACME CORP PAYROLL",
                    "category": src["category"],
                    "category_group": src["group"],
                    "account": "Chase Checking",
                    "account_type": "Checking",
                    "amount": src["amount"],
                    "currency": "USD",
                    "notes": "",
                    "tags": "",
                    "is_recurring": True,
                    "is_pending": False,
                })

        # ── Rent (1st of month) ────────────────────────────────────
        if current.day == 1:
            txn_id += 1
            records.append({
                "id": f"txn-{txn_id}",
                "date": current.isoformat(),
                "merchant": "Landlord - Rent",
                "original_name": "ZELLE RENT PAYMENT",
                "category": "Rent",
                "category_group": "Housing",
                "account": "Chase Checking",
                "account_type": "Checking",
                "amount": -2200.00,
                "currency": "USD",
                "notes": "",
                "tags": "",
                "is_recurring": True,
                "is_pending": False,
            })

        # ── Daily expenses (random selection) ──────────────────────
        daily_count = random.choices([0, 1, 2, 3, 4], weights=[10, 30, 35, 20, 5])[0]

        for _ in range(daily_count):
            m = random.choice(EXPENSE_MERCHANTS)
            lo, hi = m["range"]  # type: ignore
            amount = -round(random.uniform(lo, hi), 2)  # type: ignore

            # Subscriptions only hit once per month
            if m["category"] == "Subscriptions" and current.day != 15:
                continue
            if m["category"] in ("Gym", "Insurance", "Internet", "Phone") and current.day != 1:
                continue

            txn_id += 1
            account = "Sapphire Reserve" if random.random() < 0.6 else "Chase Checking"
            records.append({
                "id": f"txn-{txn_id}",
                "date": current.isoformat(),
                "merchant": m["merchant"],
                "original_name": str(m["merchant"]).upper().replace("'", ""),
                "category": m["category"],
                "category_group": m["group"],
                "account": account,
                "account_type": "Credit Card" if account == "Sapphire Reserve" else "Checking",
                "amount": amount,
                "currency": "USD",
                "notes": "",
                "tags": random.choice(["", "", "", "personal", "work"]),
                "is_recurring": m["category"] in ("Subscriptions", "Gym", "Insurance", "Internet", "Phone", "Rent"),
                "is_pending": current == today,
            })

        current += timedelta(days=1)

    return pd.DataFrame(records)


def generate_accounts() -> pd.DataFrame:
    """Generate synthetic account data."""
    records = []
    for i, acct in enumerate(ACCOUNTS):
        records.append({
            "id": f"acct-{i+1}",
            "name": acct["name"],
            "institution": acct["institution"],
            "type": acct["type"],
            "subtype": "",
            "balance": acct["balance"],
            "currency": "USD",
            "is_active": True,
            "is_manual": False,
            "last_synced": date.today().isoformat(),
        })
    return pd.DataFrame(records)


def main():
    parser = argparse.ArgumentParser(description="Generate sample financial data")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_LAKE_DIR)
    parser.add_argument("--months", type=int, default=6, help="Months of history")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating {args.months} months of sample data...")

    txns = generate_transactions(args.months)
    txn_path = args.output_dir / "transactions.parquet"
    txns.to_parquet(txn_path, index=False)
    print(f"  transactions: {len(txns)} rows → {txn_path}")

    accts = generate_accounts()
    acct_path = args.output_dir / "accounts.parquet"
    accts.to_parquet(acct_path, index=False)
    print(f"  accounts: {len(accts)} rows → {acct_path}")

    # Quick summary
    total_income = txns[txns["amount"] > 0]["amount"].sum()
    total_expenses = txns[txns["amount"] < 0]["amount"].sum()
    print(f"\n  Total income:   ${total_income:,.2f}")
    print(f"  Total expenses: ${abs(total_expenses):,.2f}")
    print(f"  Net:            ${total_income + total_expenses:,.2f}")


if __name__ == "__main__":
    main()
