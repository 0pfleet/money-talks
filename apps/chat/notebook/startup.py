"""IPython startup script — pre-loaded into every kernel session.

This runs before the agent sends any code. It sets up:
  - Standard analysis libraries (pd, np, plt, px)
  - DuckDB connection with views over all parquet tables in the data lake
  - Helper functions the agent can call directly
  - Display configuration for clean output
"""

import os
from pathlib import Path

import duckdb
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import plotly.io as pio

# ── Matplotlib config ──────────────────────────────────────────────────────
matplotlib.use("agg")
plt.rcParams.update({
    "figure.figsize": (10, 6),
    "figure.dpi": 150,
    "axes.titlesize": 14,
    "axes.labelsize": 12,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "legend.fontsize": 10,
    "font.family": "sans-serif",
    "axes.grid": True,
    "grid.alpha": 0.3,
})

# ── Plotly config ──────────────────────────────────────────────────────────
pio.renderers.default = "png"
pio.templates.default = "plotly_white"

# ── Pandas config ──────────────────────────────────────────────────────────
pd.set_option("display.max_rows", 50)
pd.set_option("display.max_columns", 20)
pd.set_option("display.width", 120)
pd.set_option("display.float_format", lambda x: f"${x:,.2f}" if abs(x) >= 1 else f"{x:.4f}")

# ── DuckDB connection ─────────────────────────────────────────────────────
LAKE_DIR = Path(os.environ.get("LAKE_DIR", "/home/adviser/lake"))

conn = duckdb.connect()

# Auto-register views for every parquet file in the lake
if LAKE_DIR.exists():
    for parquet_file in LAKE_DIR.glob("*.parquet"):
        table_name = parquet_file.stem
        conn.execute(
            f"CREATE VIEW IF NOT EXISTS {table_name} AS "
            f"SELECT * FROM read_parquet('{parquet_file}')"
        )

# ── Helper functions ──────────────────────────────────────────────────────


def query(sql: str) -> pd.DataFrame:
    """Execute SQL against the data lake and return a DataFrame."""
    return conn.execute(sql).fetchdf()


def tables() -> list[str]:
    """List all available tables/views."""
    result = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'").fetchall()
    return [row[0] for row in result]


def schema(table_name: str) -> pd.DataFrame:
    """Show the schema of a table."""
    return conn.execute(f"DESCRIBE {table_name}").fetchdf()


def monthly_spending(months: int = 6) -> pd.DataFrame:
    """Quick summary: monthly spending by category group for the last N months."""
    return query(f"""
        SELECT
            date_trunc('month', date::DATE) as month,
            category_group,
            ROUND(SUM(amount), 2) as total
        FROM transactions
        WHERE amount < 0
          AND date::DATE >= current_date - interval '{months} months'
        GROUP BY 1, 2
        ORDER BY 1, 3
    """)


# ── Startup message ───────────────────────────────────────────────────────
_tables = tables()
if _tables:
    print(f"money-talks kernel ready. {len(_tables)} tables loaded: {', '.join(_tables)}")
else:
    print("money-talks kernel ready. No data lake found — run 'money-talks sync' or 'money-talks import' first.")
