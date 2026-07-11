// Server-side execution gate: run generated SuiteQL against the seeded demo
// database (sql.js in node) so every query is TESTED before it is returned.
// The demo mirrors real SuiteQL semantics, so a failure here usually means the
// SQL is malformed; a dialect gap is reported as such rather than blocking.
// ponytail: module-level memoized DB — one seed per lambda instance.
import { suiteqlToSqlite, substituteParams } from './translate.js';

let dbPromise = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const [{ default: initSqlJs }, { seedDb }] = await Promise.all([
        import('sql.js'),
        import('./seed.js'),
      ]);
      const SQL = await initSqlJs();
      const db = new SQL.Database();
      seedDb(db);
      return db;
    })();
  }
  return dbPromise;
}

// Returns { tested, ok, rows?, columns?, error?, translated? }.
// tested=false means the gate itself was unavailable (e.g. wasm missing in
// this runtime) — callers must treat that as "not validated", never as a pass.
export async function demoExecute(suiteql) {
  if (typeof suiteql !== 'string' || suiteql.length > 8000) {
    return { tested: false, ok: false, error: 'not testable (empty or oversized)' };
  }
  let db;
  try {
    db = await getDb();
  } catch (err) {
    console.error('demoExec unavailable:', err?.message || err);
    return { tested: false, ok: false, error: 'demo engine unavailable' };
  }
  const { sql } = substituteParams(suiteql);
  const translated = suiteqlToSqlite(sql);
  try {
    const result = db.exec(translated);
    const rows = result.length ? result[0].values.length : 0;
    const columns = result.length ? result[0].columns : [];
    return { tested: true, ok: true, rows, columns };
  } catch (err) {
    return { tested: true, ok: false, error: String(err?.message || err).slice(0, 200), translated };
  }
}
