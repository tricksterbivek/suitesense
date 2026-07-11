// Eval harness: run NL test cases through the generate endpoint, execute the
// returned SuiteQL against the demo DB, and emit a JSONL report whose SQL can
// be validated against a real NetSuite account in SuiteQL Studio.
//
// Usage:
//   node scripts/eval.mjs [--base http://localhost:3000] [--cases scripts/eval-cases.json] [--only T01,T07]
//
// Output: scripts/eval-results.jsonl (one line per case)
import { readFileSync, writeFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { seedDb } from '../lib/seed.js';
import { suiteqlToSqlite, isReadOnly } from '../lib/translate.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = arg('--base', 'https://suitesense.vercel.app');
const CASES_PATH = arg('--cases', 'scripts/eval-cases.json');
const ONLY = arg('--only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const cases = JSON.parse(readFileSync(CASES_PATH, 'utf8')).cases.filter(
  (c) => ONLY.length === 0 || ONLY.includes(c.id),
);

const SQL = await initSqlJs();
const db = new SQL.Database();
seedDb(db);

const results = [];
for (const c of cases) {
  const row = { id: c.id, category: c.category, question: c.question };
  try {
    const res = await fetch(`${BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: c.question }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    row.sql = data.sql;
    row.source = data.source;
  } catch (err) {
    row.generate_error = String(err.message || err);
  }

  if (row.sql) {
    row.read_only = isReadOnly(row.sql);
    try {
      const out = db.exec(suiteqlToSqlite(row.sql));
      row.demo_ok = true;
      row.demo_rows = out.length ? out[0].values.length : 0;
      row.demo_columns = out.length ? out[0].columns : [];
      row.demo_sample = out.length ? out[0].values.slice(0, 3) : [];
    } catch (err) {
      row.demo_ok = false;
      row.demo_error = String(err.message || err);
    }
  }
  results.push(row);
  const status = row.generate_error ? 'GEN-ERR' : row.demo_ok ? `ok(${row.demo_rows})` : 'DEMO-ERR';
  console.log(`${c.id} [${row.source ?? '-'}] ${status} ${c.question}`);
  await new Promise((r) => setTimeout(r, Number(arg('--delay', '400')))); // respect provider rate limits
}

writeFileSync('scripts/eval-results.jsonl', results.map((r) => JSON.stringify(r)).join('\n') + '\n');
const genErr = results.filter((r) => r.generate_error).length;
const demoErr = results.filter((r) => r.demo_ok === false).length;
console.log(`\n${results.length} cases | generate errors: ${genErr} | demo execution errors: ${demoErr}`);
console.log('Wrote scripts/eval-results.jsonl');
