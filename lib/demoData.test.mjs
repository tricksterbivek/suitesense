import assert from 'node:assert';
import initSqlJs from 'sql.js';
import { buildDemoData } from './demoData.js';
import { seedDb } from './seed.js';
import { EXAMPLES } from './examples.js';
import { suiteqlToSqlite } from './translate.js';

const data = buildDemoData();

// Determinism: a second build is byte-identical (PRNG must init per call)
assert.deepStrictEqual(buildDemoData(), data, 'buildDemoData must be deterministic');

// Every curated example executes against the seeded DB and returns rows
const SQL = await initSqlJs();
const db = new SQL.Database();
seedDb(db);
for (const ex of EXAMPLES) {
  const res = db.exec(suiteqlToSqlite(ex.sql));
  assert.ok(res.length > 0 && res[0].values.length > 0, `example returned no rows: ${ex.question}`);
}

console.log(`demoData: checks passed (${data.transactions.length} txns, ${EXAMPLES.length} examples executed)`);
