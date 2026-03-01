# money-talks

> Ask your money questions in plain English. Get answers backed by your real financial data.

**money-talks** is an open-source, agentic financial analysis tool that connects to your [Monarch Money](https://www.monarchmoney.com/) account and lets you explore your finances through natural language conversation.

Instead of clicking through dashboards, you ask questions like:
- *"What are my top 5 spending categories this month?"*
- *"How much did I spend on restaurants in Q4 vs Q3?"*
- *"Am I on track with my grocery budget?"*
- *"Show me my recurring subscriptions sorted by cost"*
- *"What's my savings rate trend over the past 6 months?"*

The agent writes and executes real SQL/Python against your data, shows you the results, and remembers context across your conversation.

---

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Monarch     │────▶│  Local Data   │────▶│  Agentic Chat │
│  Money       │     │  Lake         │     │  (LLM + Tools)│
│  (API/CSV)   │     │  (Parquet)    │     │               │
└─────────────┘     └──────────────┘     └───────────────┘
      sync               DuckDB              ask anything
      import              SQL                  get answers
```

1. **Ingest** — Pull your data from Monarch Money (via API or CSV export) into a local parquet data lake
2. **Query** — DuckDB provides instant SQL over your parquet files, no database server needed
3. **Chat** — An LLM agent with notebook/SQL tools answers your questions by writing and executing queries against your data

---

## Quick Start

### Prerequisites

- Python 3.11+
- A [Monarch Money](https://www.monarchmoney.com/) account
- An Anthropic API key (for the chat agent)

### Install

```bash
git clone https://github.com/0pfleet/money-talks.git
cd money-talks
pip install -e ".[dev]"
```

### Import Your Data

**Option A: CSV Export** (easiest, no API auth needed)
1. Log into Monarch Money web → Transactions → Export CSV
2. Import it:
```bash
money-talks import ~/Downloads/transactions.csv
```

**Option B: API Sync** (pulls everything automatically)
```bash
money-talks sync
# First run: interactive login with MFA support
# Subsequent runs: reuses saved session token
```

### Query Your Data

```bash
# Direct SQL queries against your local data
money-talks query "SELECT category, SUM(amount) as total FROM transactions GROUP BY category ORDER BY total LIMIT 10"
```

### Chat With Your Data

```bash
# Coming soon — agentic chat interface
money-talks chat
```

---

## Project Structure

```
money-talks/
├── src/money_talks/
│   ├── ingest/             # Data ingestion (CSV loader + Monarch API client)
│   │   ├── csv_loader.py   #   Monarch CSV export → normalized DataFrame
│   │   └── api_client.py   #   Async API client with session persistence
│   ├── schemas/            # Schema definitions and type coercion
│   │   ├── transactions.py #   Transaction schema (id, date, merchant, amount, ...)
│   │   ├── accounts.py     #   Account schema (name, institution, balance, ...)
│   │   └── cashflow.py     #   Cashflow + budget schemas
│   ├── lake/               # Local data lake (parquet + DuckDB)
│   │   ├── storage.py      #   Atomic parquet writes
│   │   └── queries.py      #   DuckDB connection with auto-registered views
│   └── cli.py              # CLI entry point (sync, import, query)
│
├── apps/chat/              # Agentic chat application (Next.js)
│   ├── app/                #   Next.js App Router
│   │   └── api/chat/       #   Chat API endpoint (LLM + tool execution)
│   ├── lib/                #   Core logic
│   │   ├── tools/          #   Agent tools (notebook, memory)
│   │   ├── compaction/     #   Context window management
│   │   └── server/         #   Session persistence (SQLite)
│   └── components/         #   React UI components
│
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── tests/                  # Test suite
└── pyproject.toml          # Python project config
```

---

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design document covering:
- Data flow from Monarch Money → local lake → agent
- Schema validation strategy
- Agentic chat design (tools, context management, memory)
- Why DuckDB + parquet over a traditional database

---

## Data Privacy

**Your financial data never leaves your machine.**

- All data is stored locally in `~/.money-talks/lake/` as parquet files
- The Monarch Money session token is stored at `~/.money-talks/session.pickle`
- The chat agent sends your *questions* to the LLM API, not raw financial data — the agent executes queries locally and sends summarized results
- No telemetry, no analytics, no cloud storage

---

## Roadmap

- [x] CSV import + schema validation
- [x] Monarch Money API client with session persistence
- [x] Local parquet data lake with atomic writes
- [x] DuckDB SQL queries over local data
- [x] CLI interface (sync, import, query)
- [ ] Agentic chat interface (Next.js + Claude)
- [ ] Notebook tool (execute SQL/Python in conversation)
- [ ] Memory system (remember insights across sessions)
- [ ] Artifact publishing (save charts and tables)
- [ ] Budget tracking and alerts
- [ ] Investment portfolio analysis
- [ ] Multi-user support

---

## Contributing

Contributions welcome! This project is MIT licensed and designed to be extensible.

```bash
# Development setup
pip install -e ".[dev]"

# Run tests
pytest

# Lint
ruff check src/ tests/
ruff format src/ tests/
```

---

## License

MIT
