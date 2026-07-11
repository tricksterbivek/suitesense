import assert from 'node:assert';
import { suiteqlToSqlite, isReadOnly } from './translate.js';

assert.equal(
  suiteqlToSqlite('SELECT tranid FROM transaction FETCH FIRST 10 ROWS ONLY;'),
  'SELECT tranid FROM "transaction" LIMIT 10',
);
assert.equal(
  suiteqlToSqlite("SELECT TO_CHAR(trandate, 'YYYY-MM') AS month FROM transaction"),
  'SELECT strftime(\'%Y-%m\', trandate) AS month FROM "transaction"',
);
assert.equal(
  suiteqlToSqlite('SELECT NVL(memo, \'-\') FROM transactionline'),
  "SELECT IFNULL(memo, '-') FROM transactionline",
);
assert.equal(
  suiteqlToSqlite('SELECT * FROM transaction WHERE trandate > ADD_MONTHS(SYSDATE, -3)'),
  'SELECT * FROM "transaction" WHERE trandate > date(date(\'now\'), \'-3 months\')',
);
assert.equal(
  suiteqlToSqlite('SELECT id FROM transaction OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY'),
  'SELECT id FROM "transaction" LIMIT 10 OFFSET 20',
);
assert.ok(isReadOnly('SELECT * FROM customer'));
assert.ok(!isReadOnly('DROP TABLE customer'));
assert.ok(!isReadOnly('UPDATE customer SET email = 1'));

console.log('translate: all checks passed');

// --- placeholder metadata / detection / filling ---
const { detectParams, fillParams, PARAM_META } = await import('./translate.js');

const det = detectParams("SELECT 1 FROM t WHERE d >= TO_DATE(:start,'YYYY-MM-DD') AND d <= TO_DATE(:end,'YYYY-MM-DD') FETCH FIRST :n ROWS ONLY");
assert.deepEqual(det.map((p) => p.name), ['start', 'end', 'n'], 'detects ordered unique params');
assert.ok(det.every((p) => p.label && p.description && p.type), 'each param carries full metadata');
assert.deepEqual(detectParams('SELECT 1 FROM t'), [], 'no params -> empty');
assert.deepEqual(detectParams('SELECT :n, :n FROM t').map((p) => p.name), ['n'], 'dedupes repeats');

const filled = fillParams("WHERE d >= TO_DATE(:start,'YYYY-MM-DD') FETCH FIRST :n ROWS ONLY", { start: '2026-01-15', n: '25' });
assert.ok(filled.sql.includes("'2026-01-15'"), 'date value quoted');
assert.ok(filled.sql.includes('FETCH FIRST 25 ROWS'), 'number value unquoted');
const escaped = fillParams('WHERE p = :period', { period: "Jan '26" });
assert.ok(escaped.sql.includes("'Jan ''26'"), 'quotes escaped in text values');
const fallback = fillParams('FETCH FIRST :n ROWS ONLY', { n: '  ' });
assert.ok(fallback.sql.includes('FETCH FIRST 10 ROWS'), 'blank value falls back to demo default');
const injected = fillParams('FETCH FIRST :n ROWS ONLY', { n: '5; DROP TABLE x' });
assert.ok(injected.sql.includes('FETCH FIRST 5 ROWS'), 'number params sanitized to numeric');
assert.equal(Object.keys(PARAM_META).length, 6, 'closed vocabulary of six placeholders');

console.log('params: all checks passed');
