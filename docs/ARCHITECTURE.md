# Architecture

> How money-talks turns raw financial data into conversational insights.

---

## System Overview

money-talks is a three-layer system:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION                              │
│   Next.js chat UI with streaming responses, artifacts,           │
│   notebook cells, and session persistence                        │
├─────────────────────────────────────────────────────────────────┤
│                        AGENT LAYER                               │
│   LLM (Claude) with tool surface:                                │
│   Notebook (SQL/Python) · Memory · Artifact · Todo              │
├─────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                                │
│   Monarch Money → Parquet files → DuckDB views                  │
│   Schema validation · Atomic writes · Local storage             │
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

Every DataFrame passes through a schema enforcement step before storage:

```python
# Example: ensure_transaction_schema(df)
# 1. Add missing columns with pd.NA defaults
# 2. Cast columns to expected dtypes
# 3. Drop columns not in the schema
```

**Why this matters:** Monarch's API and CSV exports evolve over time. Schema enforcement means the rest of the system can rely on consistent column names and types regardless of when the data was ingested.

Schemas are defined as `TypedDict` classes (for IDE autocompletion) paired with `dict[str, str]` dtype maps (for pandas coercion):

- `TransactionRecord` — id, date, merchant, category, amount, tags, ...
- `AccountRecord` — id, name, institution, type, balance, ...
- `CashflowRecord` — month, income, expenses, savings, savings_rate
- `BudgetRecord` — category, budgeted, actual, remaining, month

### Storage: Parquet + Atomic Writes

Data is stored as Apache Parquet files in `~/.money-talks/lake/`:

```
~/.money-talks/lake/
├── transactions.parquet
├── accounts.parquet
├── cashflow.parquet
└── budgets.parquet
```

**Why Parquet?**
- Columnar format — fast aggregation queries (sum, avg, group by)
- Compressed — financial data compresses well (repetitive merchant names, categories)
- Schema-preserving — dtypes survive round-trips (unlike CSV)
- DuckDB native — zero-copy reads, no import step

**Atomic writes** prevent data corruption:
```
write to temp file → os.replace() → readers always see complete files
```

### Query Engine: DuckDB

DuckDB queries parquet files directly — no database server, no import step:

```python
conn = create_duckdb_connection("~/.money-talks/lake/")
# Automatically creates views: transactions, accounts, cashflow, budgets
conn.execute("SELECT category, SUM(amount) FROM transactions GROUP BY 1")
```

**Why DuckDB over SQLite/Postgres?**
- Reads parquet natively (no ETL pipeline)
- Columnar analytics engine (10-100x faster for aggregations vs SQLite)
- In-process — no server to manage
- SQL dialect supports window functions, CTEs, PIVOT — everything you need for financial analysis

---

## Layer 2: Agent Design

### System Prompt

The agent operates as a financial data analyst with access to your personal financial data via tools. Key prompt design principles:

1. **Accuracy over speed** — verify claims before presenting
2. **Show your work** — execute queries, don't guess at numbers
3. **Context-aware** — remember user's financial situation across the conversation
4. **Privacy-conscious** — never include raw financial data in LLM API calls; execute queries locally

### Tool Surface

The agent has access to these tools:

| Tool | Purpose | Example |
|------|---------|---------|
| **Notebook** | Execute SQL/Python, create visualizations | `SELECT category, SUM(amount) FROM transactions GROUP BY 1` |
| **SearchMemory** | Recall insights from previous sessions | "What did we discuss about subscription costs?" |
| **RecordMemory** | Save insights for future sessions | Save that user's target savings rate is 25% |
| **CreateArtifact** | Publish polished charts/tables to side panel | Monthly spending breakdown chart |
| **AskUserQuestion** | Clarify ambiguous requests | "Which time period? Last month or last quarter?" |

### Notebook Tool (Core)

The notebook is the agent's primary analytical tool. It can:

1. **Create cells** — SQL or Python code
2. **Execute cells** — Against DuckDB (SQL) or Python runtime (pandas, plotly)
3. **Edit cells** — Iterate on analysis
4. **View output** — See query results, charts, errors

The notebook runtime has a pre-configured DuckDB connection (`conn`) with all data lake tables available as views.

```sql
-- Agent writes this in a notebook cell:
SELECT
    date_trunc('month', date::DATE) as month,
    category,
    SUM(amount) as total
FROM transactions
WHERE category = 'Restaurants'
GROUP BY 1, 2
ORDER BY 1
```

### Context Window Management

Financial analysis conversations can get long (many query results, charts, iterations). The compaction system prevents context overflow:

1. **Tool output capping** — Notebook outputs truncated to ~15,000 tokens
2. **Per-step trimming** — Oldest tool outputs replaced with `[cleared]` markers
3. **Boundary compaction** — When approaching limits, summarize older messages while preserving recent context
4. **Memory offloading** — Key insights saved to memory system, recoverable in future sessions

### Memory System

Two-tier memory for cross-session persistence:

1. **Vector store (Qdrant)** — Semantic search over past insights
2. **SQLite** — Structured metadata and full text storage

The agent is prompted to record insights in STAR format:
- **S**ituation: What financial question was being explored
- **T**ask: What analysis was performed
- **A**ction: What queries/tools were used
- **R**esult: What was discovered

---

## Layer 3: Presentation

### Chat Interface (Next.js)

A web-based chat UI with:

- **Message stream** — Real-time streaming responses
- **Artifact panel** — Side panel showing polished charts and tables
- **Session management** — SQLite-backed conversation history
- **Tool rendering** — Notebook outputs, memory results, todo lists displayed inline

### Session Persistence

Sessions are stored in SQLite with append-only semantics:
- Messages are never deleted (compacted messages retain summaries)
- Artifacts stored separately from chat messages (compact manifests in chat)
- Session titles auto-generated from first message

---

## Data Flow: End to End

```
User asks: "How much did I spend on food last month?"
    │
    ▼
Agent receives question + system prompt + tool definitions
    │
    ▼
Agent calls SearchMemory("food spending patterns")
    │ → Returns: "User tracks food across Restaurants, Groceries, Fast Food categories"
    ▼
Agent calls Notebook.create_cell(sql="""
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE category IN ('Restaurants', 'Groceries', 'Fast Food')
      AND date >= date_trunc('month', current_date - interval '1 month')
      AND date < date_trunc('month', current_date)
    GROUP BY 1 ORDER BY total
""")
    │
    ▼
Agent calls Notebook.execute_cell()
    │ → Returns: table with category totals
    ▼
Agent synthesizes results:
    "Last month you spent $847 on food:
     - Groceries: $412
     - Restaurants: $328
     - Fast Food: $107
     That's up 12% from the prior month."
    │
    ▼
Agent calls RecordMemory("Monthly food spend was $847 in Jan 2026...")
```

---

## Design Decisions

### Why not just use the Monarch Money app?

Monarch's UI is great for browsing, but limited for *analysis*. You can't ask arbitrary questions, combine data in custom ways, or get insights that require multi-step reasoning. money-talks fills that gap.

### Why a local data lake instead of querying the API live?

1. **Speed** — DuckDB over local parquet is instant; API calls take seconds
2. **Privacy** — Your data stays on your machine
3. **Reliability** — Works offline, no API rate limits
4. **Flexibility** — Can enrich data with custom columns, join with other sources
5. **Cost** — No API calls per query, just one sync

### Why parquet over CSV or SQLite?

| Format | Read Speed (aggregation) | Schema Preservation | Compression | DuckDB Native |
|--------|-------------------------|--------------------|--------------|----|
| CSV | Slow | No | No | Import needed |
| SQLite | Medium | Yes | No | Attach needed |
| Parquet | Fast | Yes | Yes | Zero-copy |

### Why DuckDB over pandas-only?

- SQL is more expressive for analytical queries (window functions, CTEs, PIVOT)
- DuckDB handles larger-than-memory datasets
- The agent can write SQL directly — more natural than generating pandas code
- DuckDB's SQL dialect is well-documented, reducing LLM hallucination

---

## Future Considerations

- **Multi-source support** — Extend beyond Monarch (Plaid, CSV from any bank)
- **Scheduled syncs** — Cron/systemd timer for daily data pulls
- **Alerting** — Notify when spending exceeds thresholds
- **Collaborative** — Shared household analysis (multiple Monarch accounts)
- **MCP server** — Expose as an MCP tool for Claude Code integration
