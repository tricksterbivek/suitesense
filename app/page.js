'use client';

import { useEffect, useRef, useState } from 'react';
import { runSuiteQL } from '../lib/sqlite.js';
import { EXAMPLES } from '../lib/examples.js';
import { TABLES } from '../lib/schema.js';

const SUGGESTIONS = EXAMPLES.slice(0, 5).map((e) => e.question);
const HISTORY_KEY = 'suitesense-history';

/* Minimal inline icon set (Lucide paths) — no icon dependency. */
function Icon({ d, size = 15, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

const I = {
  sparkles: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z'],
  play: ['M6 4l14 8-14 8V4z'],
  db: ['M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z', 'M21 5v6c0 1.66-4.03 3-9 3s-9-1.34-9-3V5', 'M21 11v6c0 1.66-4.03 3-9 3s-9-1.34-9-3v-6'],
  table: ['M3 5h18v14H3z', 'M3 10h18', 'M9 5v14'],
  chart: ['M3 3v18h18', 'M8 17V9', 'M13 17V5', 'M18 17v-7'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  alert: ['M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  copy: ['M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  check: ['M20 6L9 17l-5-5'],
};

/* Regex-pass SuiteQL highlighter: strings → comments → keywords → numbers. */
const KEYWORDS =
  'SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|ORDER|BY|HAVING|AND|OR|NOT|AS|IN|LIKE|BETWEEN|CASE|WHEN|THEN|ELSE|END|DISTINCT|UNION|ALL|NULL|IS|FETCH|FIRST|NEXT|ROWS|ONLY|OFFSET|LIMIT|DESC|ASC|SUM|COUNT|AVG|MIN|MAX|ROUND|NVL|IFNULL|TO_CHAR|ADD_MONTHS|SYSDATE|STRFTIME|DATE';
const TOKEN_RE = new RegExp(`('[^']*'?)|(--[^\\n]*)|\\b(${KEYWORDS})\\b|\\b(\\d+(?:\\.\\d+)?)\\b`, 'gi');

function highlightSql(sql) {
  const esc = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(TOKEN_RE, (m, str, com, kw, num) => {
    if (str) return `<span class="tok-str">${m}</span>`;
    if (com) return `<span class="tok-com">${m}</span>`;
    if (kw) return `<span class="tok-kw">${m}</span>`;
    if (num) return `<span class="tok-num">${m}</span>`;
    return m;
  });
}

function SqlEditor({ value, onChange }) {
  const preRef = useRef(null);
  const rows = Math.min(16, value.split('\n').length + 1);
  return (
    <div className="editor">
      <pre ref={preRef} aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlightSql(value) + '\n' }} />
      <textarea
        value={value}
        rows={rows}
        spellCheck={false}
        aria-label="SuiteQL query editor"
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (preRef.current) {
            preRef.current.scrollTop = e.target.scrollTop;
            preRef.current.scrollLeft = e.target.scrollLeft;
          }
        }}
      />
    </div>
  );
}

export default function Console() {
  const [question, setQuestion] = useState('');
  const [sql, setSql] = useState('');
  const [explanation, setExplanation] = useState('');
  const [source, setSource] = useState(null);
  const [results, setResults] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  async function copySql() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error('copy failed:', err);
    }
  }

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'));
    } catch {
      /* ignore corrupt history */
    }
  }, []);

  function remember(q, generatedSql) {
    const entry = { question: q, sql: generatedSql };
    const next = [entry, ...history.filter((h) => h.question !== q)].slice(0, 12);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  async function generate(fromQuestion) {
    const q = fromQuestion ?? question;
    if (!q.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setSql(data.sql);
      setExplanation(data.explanation);
      setSource(data.source);
      remember(q, data.sql);
      await run(data.sql);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function run(query = sql) {
    setError(null);
    try {
      const t0 = performance.now();
      const res = await runSuiteQL(query);
      setElapsed(Math.max(1, Math.round(performance.now() - t0)));
      setResults(res);
    } catch (err) {
      setResults(null);
      setError(`Query failed: ${err.message}`);
    }
  }

  const started = Boolean(sql || busy);

  return (
    <>
    <div className="promo-banner">
      Live demo — every query runs in your browser, no NetSuite account needed.
    </div>
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo">
            <Icon d={I.zap} size={14} />
          </span>
          SuiteSense
          <span className="brand-sub">AI SuiteQL Console</span>
        </div>
        <div className="topbar-right">
          <span className="status">
            <span className="status-dot" />
            demo dataset · in-browser SQLite
          </span>
          <a
            className="byline"
            href="https://www.linkedin.com/in/bivekshah/"
            target="_blank"
            rel="noreferrer"
          >
            Built by Bivek Shah
          </a>
        </div>
      </header>

      <main className="console">
        <div className={started ? 'hero-collapsed' : ''}>
          {!started && (
            <section className="hero">
              <h1>Ask your ERP anything.</h1>
              <p>Plain English in, runnable SuiteQL out — executed live against a NetSuite-shaped dataset.</p>
            </section>
          )}

          <section className="ask">
            <div className="ask-card">
              <textarea
                id="q"
                rows={started ? 1 : 2}
                placeholder="e.g. Top 10 customers by revenue this year"
                aria-label="Ask a question about your NetSuite data"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    generate();
                  }
                }}
              />
              <span className="kbd-hint">↵ to run</span>
              <button className="primary" onClick={() => generate()} disabled={busy || !question.trim()}>
                <Icon d={I.sparkles} size={14} />
                {busy ? 'Generating…' : 'Generate'}
              </button>
            </div>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="chip"
                  disabled={busy}
                  onClick={() => {
                    setQuestion(s);
                    generate(s);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {busy && (
            <div className="skeleton" role="status" aria-label="Generating query">
              <div className="line" style={{ width: '38%' }} />
              <div className="line" style={{ width: '82%' }} />
              <div className="line" style={{ width: '64%' }} />
              <div className="line" style={{ width: '71%', marginBottom: 0 }} />
            </div>
          )}

          {sql && !busy && (
            <section className="panel">
              <div className="panel-head">
                <h2>
                  <Icon d={I.db} />
                  SuiteQL
                </h2>
                <div className="panel-meta">
                  {source === 'ai' && <span className="source-badge">AI</span>}
                  {source === 'examples' && <span className="source-badge examples">Curated</span>}
                </div>
                <button onClick={copySql} aria-label="Copy SuiteQL to clipboard">
                  <Icon d={copied ? I.check : I.copy} size={13} />
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button className="buy" onClick={() => run()} aria-label="Run query">
                  <Icon d={I.play} size={13} />
                  Run
                </button>
              </div>
              <SqlEditor value={sql} onChange={setSql} />
              {explanation && (
                <p className="explanation">
                  <Icon d={I.sparkles} size={13} />
                  {explanation}
                </p>
              )}
            </section>
          )}

          {error && (
            <div className="errorbox" role="alert">
              <Icon d={I.alert} size={16} />
              <span>{error}</span>
            </div>
          )}

          {results && !busy && <ResultsPanel results={results} elapsed={elapsed} />}
        </div>

        <aside className="sidebar">
          <div className="side-block">
            <h3>
              <Icon d={I.db} size={12} />
              Schema
            </h3>
            {[...new Set(TABLES.map((t) => t.family))].map((family) => (
              <div key={family}>
                <p className="family-label">{family}</p>
                {TABLES.filter((t) => t.family === family).map((t) => (
                  <details key={t.name}>
                    <summary>{t.name}</summary>
                    <ul>
                      {t.columns.map((c) => (
                        <li key={c.name}>
                          <span className="col-name">{c.name}</span>
                          <span className="col-type">{c.type}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            ))}
          </div>

          {history.length > 0 && (
            <div className="side-block">
              <h3>
                <Icon d={I.clock} size={12} />
                Recent
              </h3>
              {history.map((h) => (
                <button
                  key={h.question}
                  className="history-item"
                  title={h.question}
                  onClick={() => {
                    setQuestion(h.question);
                    setSql(h.sql);
                    setExplanation('');
                    setSource('history');
                    run(h.sql);
                  }}
                >
                  {h.question}
                </button>
              ))}
            </div>
          )}
        </aside>
      </main>

      <footer className="foot">
        <span>
          Built by <a href="https://www.linkedin.com/in/bivekshah/" target="_blank" rel="noreferrer">Bivek Shah</a> — queries never leave your browser.
        </span>
      </footer>
    </div>
    </>
  );
}

// Chartable when there are 2-3 columns, the first is a label and the last is numeric.
function isChartable(columns, rows) {
  return (
    columns.length >= 2 &&
    columns.length <= 3 &&
    rows.length >= 2 &&
    rows.length <= 40 &&
    rows.every((r) => typeof r[r.length - 1] === 'number')
  );
}

function ResultsPanel({ results, elapsed }) {
  const { columns, rows } = results;
  const chartable = isChartable(columns, rows);
  const [view, setView] = useState('table');
  const activeView = chartable ? view : 'table';

  return (
    <section className="panel elevated">
      <div className="panel-head">
        <h2>
          <Icon d={activeView === 'chart' ? I.chart : I.table} />
          Results
        </h2>
        <div className="panel-meta" aria-live="polite">
          {rows.length} rows{elapsed ? ` · ${elapsed} ms` : ''}
        </div>
        {chartable && (
          <div className="view-toggle" role="tablist" aria-label="Result view">
            <button className={activeView === 'table' ? 'active' : ''} onClick={() => setView('table')}>
              Table
            </button>
            <button className={activeView === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>
              Chart
            </button>
          </div>
        )}
      </div>
      {activeView === 'chart' ? <BarChart columns={columns} rows={rows} /> : <ResultsTable columns={columns} rows={rows} />}
    </section>
  );
}

function BarChart({ columns, rows }) {
  const valueIndex = rows[0].length - 1;
  const max = Math.max(...rows.map((r) => Math.abs(r[valueIndex])), 1);
  return (
    <div className="chart">
      {rows.map((row, i) => (
        <div className="chart-row" key={i}>
          <div className="chart-label" title={String(row[0])}>
            {String(row[0])}
          </div>
          <div className="chart-track">
            <div
              className={`chart-bar${row[valueIndex] < 0 ? ' negative' : ''}`}
              style={{ width: `${(Math.abs(row[valueIndex]) / max) * 100}%` }}
              title={`${row[0]}: ${formatCell(row[valueIndex])}`}
            />
          </div>
          <div className="chart-value">{formatCell(row[valueIndex])}</div>
        </div>
      ))}
      <div className="chart-caption">
        {columns[valueIndex]} by {columns[0]}
      </div>
    </div>
  );
}

function ResultsTable({ columns, rows }) {
  if (columns.length === 0) return <p className="explanation">No rows returned.</p>;
  const numeric = columns.map((_, j) => rows.every((r) => typeof r[j] === 'number' || r[j] == null));
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c, j) => (
              <th key={c} className={numeric[j] ? 'num' : ''}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={numeric[j] ? 'num' : ''}>
                  {formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value) {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  if (typeof value === 'number' && Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US');
  }
  return value ?? '—';
}
