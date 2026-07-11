// Browser-side demo database: sql.js (SQLite compiled to wasm) seeded with
// the synthetic demo dataset. Queries run entirely in the visitor's browser —
// the demo never touches a real NetSuite account.
import initSqlJs from 'sql.js';
import { seedDb } from './seed.js';
import { suiteqlToSqlite, substituteParams, isReadOnly } from './translate.js';

let dbPromise = null;

async function createDb() {
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const db = new SQL.Database();
  seedDb(db);
  return db;
}

export function getDb() {
  if (!dbPromise) dbPromise = createDb();
  return dbPromise;
}

export async function runSuiteQL(suiteql) {
  if (!isReadOnly(suiteql)) {
    throw new Error('Only SELECT queries are allowed in the demo console.');
  }
  const db = await getDb();
  const { sql: withParams, substituted } = substituteParams(suiteql);
  const sqlite = suiteqlToSqlite(withParams);
  const result = db.exec(sqlite);
  if (result.length === 0) return { columns: [], rows: [], translated: sqlite, substituted };
  const { columns, values } = result[0];
  return { columns, rows: values, translated: sqlite, substituted };
}
