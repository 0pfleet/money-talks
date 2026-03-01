"""CLI entry point for money-talks.

Usage:
    money-talks sync          # Pull latest data from Monarch Money API
    money-talks import FILE   # Import a Monarch CSV export
    money-talks query "SQL"   # Run SQL against your local data lake
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from money_talks.ingest.csv_loader import load_transactions_csv
from money_talks.ingest.api_client import MonarchClient
from money_talks.lake.storage import write_parquet_atomic
from money_talks.lake.queries import create_duckdb_connection


DEFAULT_LAKE_DIR = Path.home() / ".money-talks" / "lake"
DEFAULT_SESSION_FILE = Path.home() / ".money-talks" / "session.pickle"


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="money-talks",
        description="Agentic financial data analysis powered by Monarch Money",
    )
    sub = parser.add_subparsers(dest="command")

    # ── sync ───────────────────────────────────────────────────────────────
    sync_parser = sub.add_parser("sync", help="Pull latest data from Monarch Money")
    sync_parser.add_argument(
        "--lake-dir", type=Path, default=DEFAULT_LAKE_DIR, help="Data lake directory"
    )

    # ── import ─────────────────────────────────────────────────────────────
    import_parser = sub.add_parser("import", help="Import a Monarch CSV export")
    import_parser.add_argument("file", type=Path, help="Path to Monarch CSV export")
    import_parser.add_argument(
        "--lake-dir", type=Path, default=DEFAULT_LAKE_DIR, help="Data lake directory"
    )

    # ── query ──────────────────────────────────────────────────────────────
    query_parser = sub.add_parser("query", help="Run SQL against your local data lake")
    query_parser.add_argument("sql", help="SQL query string")
    query_parser.add_argument(
        "--lake-dir", type=Path, default=DEFAULT_LAKE_DIR, help="Data lake directory"
    )

    args = parser.parse_args()

    if args.command == "sync":
        asyncio.run(_cmd_sync(args.lake_dir))
    elif args.command == "import":
        _cmd_import(args.file, args.lake_dir)
    elif args.command == "query":
        _cmd_query(args.sql, args.lake_dir)
    else:
        parser.print_help()
        sys.exit(1)


async def _cmd_sync(lake_dir: Path) -> None:
    """Pull all data from Monarch Money API and write to local lake."""
    client = MonarchClient(session_file=DEFAULT_SESSION_FILE)
    try:
        client.load_session()
        print("Loaded existing session.")
    except FileNotFoundError:
        print("No saved session. Starting interactive login...")
        await client.login_interactive()

    print(f"Syncing data to {lake_dir}...")
    paths = await client.export_all(lake_dir)
    for table, path in paths.items():
        print(f"  {table}: {path}")
    print("Done.")


def _cmd_import(csv_path: Path, lake_dir: Path) -> None:
    """Import a Monarch CSV export into the local data lake."""
    print(f"Loading {csv_path}...")
    df = load_transactions_csv(csv_path)
    print(f"  {len(df)} transactions loaded.")

    out = write_parquet_atomic(df, lake_dir / "transactions.parquet")
    print(f"  Written to {out}")


def _cmd_query(sql: str, lake_dir: Path) -> None:
    """Run a SQL query against the local data lake via DuckDB."""
    if not lake_dir.exists():
        print(f"No data lake found at {lake_dir}. Run 'money-talks sync' or 'money-talks import' first.")
        sys.exit(1)

    conn = create_duckdb_connection(lake_dir)
    result = conn.execute(sql).fetchdf()
    print(result.to_string())
