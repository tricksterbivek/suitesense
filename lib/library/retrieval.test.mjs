import assert from 'node:assert';
import { retrieve, bestMatch, relevantFailures, QUERIES, CATEGORIES } from './index.js';
import { validateSuiteQL } from '../validate.js';

// --- library integrity ---
assert.ok(QUERIES.length >= 12, 'library should have a substantive corpus');
for (const q of QUERIES) {
  assert.ok(q.id && q.category && q.intent && q.sql && Array.isArray(q.keywords), `entry ${q.id} well-formed`);
  assert.ok(q.keywords.length > 0, `entry ${q.id} has keywords`);
  assert.ok(q.caveats && q.caveats.length > 10, `entry ${q.id} documents caveats`);
}
assert.ok(CATEGORIES.includes('revenue') && CATEGORIES.includes('ar-aging'), 'expected categories present');

// --- retrieval routes to the right family ---
const revenue = retrieve('what was our total revenue this year');
assert.equal(revenue[0].category, 'revenue', 'revenue question -> revenue entry');

const ar = retrieve('which customers owe us money');
assert.ok(ar.some((r) => r.category === 'ar-aging'), 'owe -> ar-aging');

const vendor = retrieve('how much did we spend with suppliers');
assert.ok(vendor.some((r) => r.category === 'ap-vendor'), 'spend/suppliers -> ap-vendor');

const inv = retrieve('stock on hand by warehouse');
assert.ok(inv.some((r) => r.category === 'inventory'), 'stock -> inventory');

// unrelated gibberish returns nothing (no silent wrong-answer)
assert.equal(retrieve('xyzzy plugh foobar').length, 0, 'no false matches on gibberish');

// bestMatch clears a floor
assert.ok(bestMatch('open AR by customer'), 'clear question yields a confident match');
assert.equal(bestMatch('the'), null, 'stopword-only question has no confident match');

// --- validator catches the documented traps ---
const t = (sql) => validateSuiteQL(sql).issues.map((i) => i.id);

assert.ok(t("SELECT * FROM transaction WHERE status = 'open'").includes('F-STATUS-WORD'), 'status word caught');
assert.ok(t('SELECT t.subsidiary FROM transaction t').includes('F-TXN-SUBSIDIARY'), 'txn.subsidiary caught');
assert.ok(
  t("SELECT SUM(l.netamount) FROM transactionline l JOIN transaction t ON t.id=l.transaction WHERE t.type='CustInvc'").includes('F-NO-MAINLINE'),
  'line sum without mainline caught',
);
assert.ok(t('SELECT c.territory FROM customer c').includes('F-TERRITORY'), 'territory caught');
assert.ok(t('SELECT x FROM y ORDER BY z OFFSET 10 ROWS FETCH NEXT 5 ROWS ONLY').includes('F-OFFSET'), 'offset caught');

// verified library queries must themselves be clean
for (const q of QUERIES) {
  const { issues } = validateSuiteQL(q.sql);
  const criticals = issues.filter((i) => i.severity === 'critical');
  assert.equal(criticals.length, 0, `library entry ${q.id} must not trip a critical validator rule: ${criticals.map((c) => c.id)}`);
}

// a correct query passes clean
const good = `SELECT c.companyname, SUM(t.foreignamountunpaid) AS open_ar FROM transaction t JOIN customer c ON c.id=t.entity WHERE t.type='CustInvc' AND t.foreignamountunpaid>0 GROUP BY c.companyname`;
assert.equal(validateSuiteQL(good).issues.filter((i) => i.severity === 'critical').length, 0, 'correct AR query is clean');

// relevantFailures returns something useful for a risky question
assert.ok(relevantFailures('open invoices by status').length > 0, 'relevant failures surfaced');

console.log(`library+validate: all checks passed (${QUERIES.length} verified queries, ${CATEGORIES.length} categories)`);
