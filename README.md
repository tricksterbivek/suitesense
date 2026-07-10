# SuiteSense — AI SuiteQL Console for NetSuite

Ask questions about NetSuite data in plain English. SuiteSense generates the
SuiteQL with Claude, runs it, and renders the answer as a table or chart.

**Live demo:** https://suitesense.vercel.app

```
"Top 10 customers by revenue"
        │
        ▼
┌───────────────────┐   Claude (claude-opus-4-8)
│   /api/generate   │──  schema catalog + few-shot examples
└───────────────────┘   structured JSON output → SuiteQL
        │
        ▼
┌───────────────────┐   SuiteQL → SQLite dialect bridge
│  browser SQLite   │──  (FETCH FIRST → LIMIT, NVL, TO_CHAR, …)
│  (sql.js, wasm)   │   seeded NetSuite-shaped demo dataset
└───────────────────┘
        │
        ▼
   results table / bar chart
```

## Why

Every NetSuite developer and admin writes SuiteQL daily — and re-looks-up the
Oracle-flavoured syntax (`FETCH FIRST`, `NVL`, `TO_CHAR`) and analytics table
names every time. SuiteSense turns the question straight into a runnable query.

## How the demo stays safe

The public demo never touches a real NetSuite account. Queries execute against
a **seeded, deterministic SQLite database running entirely in your browser**
(sql.js/wasm) whose 15 tables mirror the real NetSuite analytics schema —
transactions and lines (AR **and** AP), the GL layer
(`transactionaccountingline`, `account`, `accountingperiod`), entities
(`customer`, `vendor`, `employee`), items and `inventorybalance`, and
dimensions (`subsidiary`, `location`, `department`, `classification`,
`currency`). Generated SuiteQL is bridged to SQLite by a small dialect
translator, so the SQL you see is genuine SuiteQL that transfers to a live
account.

- Read-only guard: anything except `SELECT` is rejected client-side.
- No key configured? `/api/generate` falls back to a curated example library,
  so the demo works end to end regardless.

## Stack

- **Next.js 15** (App Router, plain JavaScript)
- **Claude API** — (Optional )  `claude-opus-4-8`, adaptive thinking, structured JSON output
- **sql.js** — SQLite compiled to wasm, seeded in the browser
- Zero CSS/chart libraries — hand-rolled dark theme, CSS-only bar charts

## Run locally

```sh
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for live AI generation (Optional) 
npm run dev
```

Without a key the console still works using the curated example library.

```sh
npm run check   # dialect-translator self-tests
```

## Roadmap

- Live mode: execute against a real NetSuite account via a secured RESTlet
  (SuiteQL passthrough with token auth) — the executor is already an adapter.
- Saved query collections and shareable links.
