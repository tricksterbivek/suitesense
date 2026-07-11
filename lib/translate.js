// Translates the Oracle-flavoured SuiteQL subset our AI emits into SQLite
// so demo mode can genuinely execute it in the browser and in the server-side
// execution gate.
// ponytail: regex dialect bridge, covers the common read-only patterns;
// swap for a real parser if demo queries outgrow it.

const TO_CHAR_FORMATS = [
  [/'YYYY-MM'/i, "'%Y-%m'"],
  [/'YYYY'/i, "'%Y'"],
  [/'MM'/i, "'%m'"],
  [/'YYYY-MM-DD'/i, "'%Y-%m-%d'"],
  [/'IW'/i, "'%W'"],
  [/'YYYY-IW'/i, "'%Y-%W'"],
];

// :param placeholders used by library queries -> demo-friendly literals.
// Values chosen to hit the seeded 2-year window (Jul 2024 – Jul 2026).
export const DEMO_PARAMS = {
  start: "'2025-07-01'",
  end: "'2026-06-30'",
  period: "'Jan 2026'",
  acctnumber: "'4000'",
  n: '10',
  threshold: '100',
};

export function substituteParams(sql, params = DEMO_PARAMS) {
  let changed = false;
  const out = sql.replace(/:(start|end|period|acctnumber|n|threshold)\b/gi, (m, name) => {
    const v = params[name.toLowerCase()];
    if (v === undefined) return m;
    changed = true;
    return v;
  });
  return { sql: out, substituted: changed };
}

// BUILTIN.DF(alias.field) -> correlated name lookup against the demo lookup
// tables; unknown fields (incl. status) pass the raw value through.
const DF_LOOKUP = {
  subsidiary: '(SELECT s_df.name FROM subsidiary s_df WHERE s_df.id = $1)',
  location: '(SELECT l_df.name FROM location l_df WHERE l_df.id = $1)',
  department: '(SELECT d_df.name FROM department d_df WHERE d_df.id = $1)',
  class: '(SELECT c_df.name FROM classification c_df WHERE c_df.id = $1)',
  item: '(SELECT i_df.displayname FROM item i_df WHERE i_df.id = $1)',
  entity: "COALESCE((SELECT cu_df.companyname FROM customer cu_df WHERE cu_df.id = $1), (SELECT v_df.companyname FROM vendor v_df WHERE v_df.id = $1))",
  employee: "(SELECT e_df.firstname || ' ' || e_df.lastname FROM employee e_df WHERE e_df.id = $1)",
  currency: '(SELECT cur_df.name FROM currency cur_df WHERE cur_df.id = $1)',
  account: '(SELECT a_df.fullname FROM account a_df WHERE a_df.id = $1)',
  postingperiod: '(SELECT p_df.periodname FROM accountingperiod p_df WHERE p_df.id = $1)',
};

function translateBuiltinDf(sql) {
  return sql.replace(/BUILTIN\.DF\s*\(\s*([\w."]+)\s*\)/gi, (m, expr) => {
    const field = expr.split('.').pop().replace(/"/g, '').toLowerCase();
    const lookup = DF_LOOKUP[field];
    return lookup ? lookup.replaceAll('$1', expr) : expr; // status etc: raw code passthrough
  });
}

export function suiteqlToSqlite(sql) {
  let out = sql.trim().replace(/;\s*$/, '');

  out = translateBuiltinDf(out);

  // FETCH FIRST n ROWS ONLY -> LIMIT n (with optional OFFSET n ROWS)
  out = out.replace(/OFFSET\s+(\d+)\s+ROWS?\s+FETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY/gi, 'LIMIT $2 OFFSET $1');
  out = out.replace(/FETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY/gi, 'LIMIT $1');

  // TRUNC family (order matters: arithmetic forms before bare forms)
  out = out.replace(/TRUNC\s*\(\s*SYSDATE\s*\)\s*([+-])\s*(\d+)/gi, (m, op, n) => `date('now', '${op === '-' ? '-' : '+'}${n} days')`);
  out = out.replace(/TRUNC\s*\(\s*SYSDATE\s*,\s*'(?:MM|MON|MONTH)'\s*\)/gi, "date('now', 'start of month')");
  out = out.replace(/TRUNC\s*\(\s*SYSDATE\s*,\s*'(?:YEAR|YYYY|YY)'\s*\)/gi, "date('now', 'start of year')");
  out = out.replace(/TRUNC\s*\(\s*SYSDATE\s*\)/gi, "date('now')");
  out = out.replace(/TRUNC\s*\(\s*([\w."]+)\s*,\s*'(?:MM|MON|MONTH)'\s*\)/gi, "date($1, 'start of month')");
  out = out.replace(/TRUNC\s*\(\s*([\w."]+)\s*,\s*'(?:YEAR|YYYY|YY)'\s*\)/gi, "date($1, 'start of year')");
  out = out.replace(/TRUNC\s*\(\s*([\w."]+)\s*\)(?!\s*,)/gi, (m, inner) =>
    /^[\w."]+$/.test(inner) && !/^\d+$/.test(inner) ? `date(${inner})` : m);

  // Oracle functions -> SQLite equivalents
  out = out.replace(/\bNVL\s*\(/gi, 'IFNULL(');
  out = out.replace(/\bSYSDATE\b/gi, "date('now')");
  for (const [ora, fmt] of TO_CHAR_FORMATS) {
    out = out.replace(new RegExp(`TO_CHAR\\s*\\(([^,]+),\\s*${ora.source}\\s*\\)`, 'gi'), `strftime(${fmt}, $1)`);
  }
  // TO_CHAR(x,'Q') -> calendar quarter number
  out = out.replace(/TO_CHAR\s*\(([^,]+),\s*'Q'\s*\)/gi, "CAST((CAST(strftime('%m', $1) AS INTEGER) + 2) / 3 AS TEXT)");
  // TO_DATE('2026-01-01', 'YYYY-MM-DD') -> the literal
  out = out.replace(/TO_DATE\s*\(\s*('[^']+')\s*,\s*'[^']+'\s*\)/gi, 'date($1)');
  // ADD_MONTHS(x, -n) -> date(x, '-n months'); x may contain one nested call
  out = out.replace(/ADD_MONTHS\s*\(\s*((?:[^(),]|\([^()]*\))+?)\s*,\s*(-?\d+)\s*\)/gi, "date($1, '$2 months')");

  // "transaction" is a reserved word in SQLite; NetSuite uses it as a table name.
  out = out.replace(/\btransaction\b(?!line|accountingline)/gi, '"transaction"');

  return out;
}

export function isReadOnly(sql) {
  return !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|PRAGMA|REPLACE)\b/i.test(sql);
}
