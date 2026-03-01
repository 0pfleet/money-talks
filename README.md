# money-talks

> Monarch Money is the ledger. Money Talks is the adviser.

**money-talks** is an open-source financial adviser powered by your [Monarch Money](https://www.monarchmoney.com/) data. It connects to your account, pulls your transactions into a local data lake, and lets you have a real conversation about your money — backed by charts, SQL, and actual numbers.

It doesn't just answer questions. It notices patterns, flags concerns, and tells you what to do about them:

- *"How much did I spend on food?"* → Answers the question, shows a chart, AND flags that you're $147 over your food budget — driven by DoorDash orders on weeknights.
- *"Am I on track with my savings?"* → Shows your savings rate trend, compares to your 25% target, and suggests which subscriptions to cut.
- *"What's going on with my credit card?"* → Breaks down the balance by category, identifies recurring charges you forgot about, and shows the payoff timeline.

The agent writes and executes real Python/SQL against your data, generates charts with matplotlib and plotly, and remembers insights across sessions.

---

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────────────┐
│  Monarch     │────▶│  Local Data   │────▶│  Financial Adviser (Claude)  │
│  Money       │     │  Lake         │     │  ┌──────────────────────┐   │
│  (API/CSV)   │     │  (Parquet)    │     │  │ Jupyter Kernel       │   │
└─────────────┘     └──────────────┘     │  │ pandas, matplotlib,  │   │
      sync               DuckDB          │  │ plotly, DuckDB       │   │
      import              SQL            │  └──────────────────────┘   │
                                          └──────────────────────────────┘
```

1. **Ingest** — Pull your data from Monarch Money (via API or CSV export) into a local parquet data lake
2. **Query** — DuckDB provides instant SQL over your parquet files, no server needed
3. **Advise** — Claude executes real code in a Jupyter kernel, generates charts, and gives you actionable financial advice

---

## Quick Start

### Prerequisites

- Python 3.11+
- Docker (for the Jupyter kernel)
- A [Monarch Money](https://www.monarchmoney.com/) account
- An Anthropic API key (for Claude)

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
# Start the Jupyter kernel (runs in Docker)
cd apps/chat && npm run kernel:up

# Start the chat app
npm run dev
# Open http://localhost:3000
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
├── apps/chat/              # Financial adviser chat app (Next.js)
│   ├── app/                #   Next.js App Router
│   │   └── api/chat/       #   Chat endpoint (Claude + Vercel AI SDK)
│   ├── lib/                #   Core logic
│   │   ├── tools/          #   Agent tools (execute, memory)
│   │   │   └── notebook/   #     Jupyter kernel client + output parsing
│   │   ├── compaction/     #   Context window management
│   │   └── server/         #   Session persistence (SQLite)
│   ├── notebook/           #   Jupyter Kernel Gateway (Docker)
│   │   ├── Dockerfile      #     Python 3.12 + analysis stack
│   │   ├── startup.py      #     Pre-loaded libs + DuckDB connection
│   │   └── docker-compose.yml
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
- The ledger vs adviser separation (Monarch vs Money Talks)
- Jupyter Kernel Gateway integration and figure capture
- Single `execute` tool design (and why not multi-command)
- Data flow: Monarch → schema validation → parquet → DuckDB → agent → advice
- Context window compaction for long analysis sessions

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
- [x] Jupyter Kernel Gateway (Docker) with pre-loaded analysis stack
- [x] Execute tool with figure capture and output truncation
- [x] Financial adviser system prompt and agent loop
- [x] Chat API endpoint (Claude + Vercel AI SDK)
- [ ] Chat UI (message stream, inline charts, session sidebar)
- [ ] Memory system (Qdrant + SQLite, cross-session persistence)
- [ ] Context window compaction
- [ ] Budget tracking and proactive alerts
- [ ] Investment portfolio analysis
- [ ] Multi-source support (Plaid, CSV from any bank)

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
