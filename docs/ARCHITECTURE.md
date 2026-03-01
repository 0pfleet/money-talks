# Architecture

> Monarch Money is the ledger. Money Talks is the adviser.

Monarch Money tracks *what happened* with your money. Money Talks tells you *what it means* and *what to do about it* — by combining your real financial data with an LLM agent that can execute code, generate charts, and remember insights across sessions.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION                              │
│   Next.js chat UI with streaming responses, inline charts,       │
│   and session persistence (SQLite)                               │
├──────────────────────────┬──────────────────────────────────────┤
│      AGENT LAYER         │       EXECUTION LAYER                 │
│                          │                                       │
│   Claude (Anthropic)     │   Jupyter Kernel Gateway (Docker)     │
│   ┌──────────────────┐   │   ┌─────────────────────────────┐    │
│   │  System Prompt:   │   │   │  IPython kernel with:        │    │
│   │  Financial Adviser│──▶│   │  • conn (DuckDB)             │    │
│   │                   │   │   │  • pd, np, plt, px           │    │
│   │  Tools:           │   │   │  • query(sql) helper         │    │
│   │  • execute        │   │   │  • monthly_spending()        │    │
│   │  • searchMemory   │   │   │                              │    │
│   │  • recordMemory   │   │   │  Returns: text, base64 PNG,  │    │
│   └──────────────────┘   │   │  errors, DataFrames           │    │
│                          │   └─────────────────────────────┘    │
├──────────────────────────┴──────────────────────────────────────┤
│                        DATA LAYER                                │
│   Monarch Money ──▶ Schema Validation ──▶ Parquet Data Lake     │
│   (API or CSV)       ensure_*_schema()    ~/.money-talks/lake/  │
│                                                 │                │
│                                           DuckDB (zero-copy)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Data Ingestion & Storage

### Data Sources

| Source | Method | Use Case |
|--------|--------|----------|
| Monarch CSV Export | `money-talks import file.csv` | One-time import, no API auth needed |
| Monarch Money API | `money-talks sync` | Automated pull of all data types |

### Schema Validation

Every DataFrame passes through schema enforcement before storage:

```python
# ensure_transaction_schema(df):
# 1. Add missing columns with pd.NA defaults
# 2. Cast columns to expected dtypes
# 3. Drop columns not in the schema
```

Schemas are defined as `TypedDict` classes paired with `dict[str, str]` dtype maps:

- `TransactionRecord` — id, date, merchant, category, amount, tags, ...
- `AccountRecord` — id, name, institution, type, balance, ...
- `CashflowRecord` — month, income, expenses, savings, savings_rate
- `BudgetRecord` — category, budgeted, actual, remaining, month

**Why schema enforcement?** Monarch's API and CSV exports evolve over time. The schema boundary means everything downstream can trust consistent column names and types.

### Storage: Parquet + Atomic Writes

```
~/.money-talks/lake/
├── transactions.parquet
├── accounts.parquet
├── cashflow.parquet
└── budgets.parquet
```

**Why Parquet?**
- Columnar — fast aggregation (sum, avg, group by)
- Compressed — repetitive merchant names and categories compress well
- Schema-preserving — dtypes survive round-trips (unlike CSV)
- DuckDB native — zero-copy reads, no import step

**Atomic writes** use temp file + `os.replace()` so readers never see partial files.

### Query Engine: DuckDB

DuckDB reads parquet directly — no server, no import:

```python
conn = create_duckdb_connection("~/.money-talks/lake/")
conn.execute("SELECT category, SUM(amount) FROM transactions GROUP BY 1")
```

**Why DuckDB?** Columnar analytics engine (10-100x faster than SQLite for aggregations), native parquet support, rich SQL dialect (window functions, CTEs, PIVOT).

---

## Layer 2: Agent + Execution

### The Financial Adviser

The agent is positioned as a **sharp, candid financial adviser** — not a passive report generator. Key behaviors:

- **Query first, talk second.** Every financial claim is backed by executed code.
- **Visualize by default.** Trends, comparisons, and distributions get charts.
- **Be the adviser.** Interpret results: what does this mean? Is it good or bad? What should the user do?
- **Be proactive.** Surface patterns the user didn't ask about.

### Single Execute Tool (Industry Standard)

The agent has one primary tool: `execute(code: string)`.

This is the pattern used by OpenAI Code Interpreter, E2B, Open Interpreter, and every major agent framework. A single code-block tool outperforms multi-command notebook tools (create/edit/execute/view) because LLMs produce better results when they can write complete code blocks rather than manage cell state through multi-step sequences.

```typescript
tools: {
  execute: {
    parameters: z.object({
      code: z.string()
    }),
    execute: async ({ code }) => {
      const result = await executeInKernel(code);
      return { text: formatResultForLLM(result), figures: result.figures };
    }
  }
}
```

The agent loop (`maxSteps: 10`) lets Claude iterate: execute code → see results → execute more code → respond.

### Jupyter Kernel Gateway

Code execution runs in a **Jupyter Kernel Gateway** instance inside Docker:

```
Next.js API route
    │
    │ @jupyterlab/services (WebSocket)
    │
    ▼
Kernel Gateway (Docker, port 8888)
    │
    │ ZMQ (internal)
    │
    ▼
ipykernel (Python 3.12)
    Pre-loaded: conn, pd, np, plt, px, query()
```

**Why Kernel Gateway over full Jupyter Server?**
- Purpose-built for headless, programmatic access — no notebook UI, no file browser
- Same WebSocket API, stripped down
- Token auth + CORS out of the box
- ~500MB Docker image vs ~4GB for scipy-notebook

### Pre-Loaded Kernel Environment

Every kernel session starts with an IPython startup script (`startup.py`) that provides:

```python
# Pre-connected DuckDB with views over all financial tables
conn = duckdb.connect()
# Views auto-registered from parquet files

# Helper functions
query(sql)              # Execute SQL → DataFrame
tables()                # List available tables
schema(table_name)      # Show table schema
monthly_spending(n)     # Quick N-month spending summary

# Pre-configured libraries
import pandas as pd
import matplotlib.pyplot as plt
import plotly.express as px

# Display settings
plt.rcParams: figure.figsize=(10,6), dpi=150, grid=True
pd.set_option: max_rows=50, float_format=$X,XXX.XX
```

**State persists between executions.** Variables, imports, and DataFrames carry over — the agent can build on previous results across multiple tool calls.

### Figure Capture

Matplotlib and Plotly figures are captured via Jupyter's `display_data` IOPub messages:

| Library | Output Format | How It Works |
|---------|--------------|---------------|
| matplotlib | Base64 PNG | `agg` backend + inline rendering → `image/png` in IOPub |
| plotly | Base64 PNG | `kaleido` renderer → `image/png` in IOPub |

Figures are returned as base64 strings in the tool result. The chat UI renders them inline alongside the agent's explanation.

### Output Handling

| Output Type | Strategy |
|-------------|----------|
| Text / DataFrames | Truncate at ~15,000 tokens. Preserve head (70%) + tail (20%), remove middle |
| Figures | Base64 PNG, max 5 per execution |
| Errors | Full traceback — LLMs are excellent at self-correcting from tracebacks |
| Timeout | 30s default, kernel interrupt on expiry |

### Memory System

Two-tier memory for cross-session persistence:

1. **Qdrant** (vector DB) — Semantic search over past insights
2. **SQLite** — Structured metadata and full text

The agent records insights in STAR format:
- **S**ituation: What financial question was explored
- **T**ask: What analysis was performed
- **A**ction: What queries/tools were used
- **R**esult: What was discovered

### Context Window Management

Financial analysis conversations get long. Three-tier compaction prevents overflow:

1. **Tool output capping** — Text truncated to ~15,000 tokens per execution
2. **Per-step trimming** — Oldest tool outputs replaced with `[cleared]` markers
3. **Boundary compaction** — Summarize older message prefix, preserve recent context raw

---

## Layer 3: Presentation

### Chat Interface (Next.js)

- **Streaming responses** — Real-time token-by-token display
- **Inline charts** — matplotlib/plotly figures rendered alongside text
- **Session sidebar** — SQLite-backed conversation history
- **Session persistence** — Append-only messages, auto-generated titles

### Session Schema

```sql
sessions(id, title, created_at, updated_at)
messages(id, session_id, role, content, metadata, created_at)
artifacts(id, session_id, name, cells, created_at)
```

---

## Data Flow: End to End

```
User: "How much did I spend on food last month?"
    │
    ▼
Agent checks memory: SearchMemory("food spending")
    → "User tracks food across Restaurants, Groceries, Fast Food"
    │
    ▼
Agent executes code:
    df = query("""
        SELECT category, SUM(amount) as total
        FROM transactions
        WHERE category IN ('Restaurants', 'Groceries', 'Fast Food')
          AND date::DATE >= date_trunc('month', current_date - interval '1 month')
        GROUP BY 1 ORDER BY total
    """)
    │
    ▼
Agent executes chart:
    df.plot.barh(x='category', y='total')
    plt.title('Food Spending — Last Month')
    plt.show()
    │
    ▼
Agent responds (text + chart):
    "You spent $847 on food last month:
     • Groceries: $412 (49%)
     • Restaurants: $328 (39%) — up 22% from prior month
     • Fast Food: $107 (13%)

     That's $147 over your $700 food budget. Restaurants are the driver —
     mostly DoorDash orders on weeknights. Consider setting a weekly
     DoorDash limit of $50 to get back on target."
    │
    ▼
Agent saves insight: RecordMemory("Feb 2026 food: $847, $147 over budget...")
```

---

## Design Decisions

### Why Monarch as the ledger + Money Talks as the adviser?

Monarch is great at what it does: aggregating accounts, categorizing transactions, tracking budgets. But it can't answer arbitrary questions, generate custom visualizations, or reason about your financial patterns. Money Talks is the analysis and advice layer that sits on top.

### Why local execution instead of cloud?

1. **Privacy** — Financial data stays on your machine
2. **Speed** — DuckDB over local parquet is instant
3. **Cost** — No per-query API costs (only LLM calls for the chat)
4. **Flexibility** — Enrich data, join with other sources, no API limits

### Why a single `execute` tool?

Every major agent framework (OpenAI, E2B, Open Interpreter) converges on this pattern. LLMs write better code when they can produce complete blocks rather than managing notebook cell state through multi-step tool calls. The kernel maintains state between calls, so the agent can still iterate.

### Why DuckDB over pandas-only?

- SQL is more expressive for analytics (window functions, CTEs, PIVOT)
- DuckDB handles larger-than-memory datasets
- The agent writes SQL naturally — well-documented dialect reduces hallucination
- Both SQL and pandas are available — the agent picks the right tool for each task

---

## Running Locally

```bash
# 1. Start the Jupyter kernel
cd apps/chat && npm run kernel:up

# 2. Import your Monarch data
money-talks import ~/Downloads/transactions.csv
# or
money-talks sync

# 3. Start the chat app
cd apps/chat && npm run dev
```

Environment variables:
```
ANTHROPIC_API_KEY=sk-...          # Required: Claude API access
JUPYTER_BASE_URL=http://localhost:8888
JUPYTER_TOKEN=money-talks-dev
LAKE_DIR=~/.money-talks/lake
```

---

## Future Considerations

- **Multi-source support** — Extend beyond Monarch (Plaid, CSV from any bank)
- **Scheduled syncs** — Cron/systemd timer for daily data pulls
- **Alerting** — Notify when spending exceeds thresholds
- **Collaborative** — Shared household analysis (multiple Monarch accounts)
- **MCP server** — Expose as an MCP tool for Claude Code integration
