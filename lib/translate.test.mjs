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
