// Translates the Oracle-flavoured SuiteQL subset our AI emits into SQLite
// so demo mode can genuinely execute it in the browser.
// ponytail: regex dialect bridge, covers the common read-only patterns;
// swap for a real parser if demo queries outgrow it.

const TO_CHAR_FORMATS = [
  [/'YYYY-MM'/i, "'%Y-%m'"],
  [/'YYYY'/i, "'%Y'"],
  [/'MM'/i, "'%m'"],
  [/'YYYY-MM-DD'/i, "'%Y-%m-%d'"],
];

export function suiteqlToSqlite(sql) {
  let out = sql.trim().replace(/;\s*$/, '');

  // FETCH FIRST n ROWS ONLY -> LIMIT n (with optional OFFSET n ROWS)
  out = out.replace(/OFFSET\s+(\d+)\s+ROWS?\s+FETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY/gi, 'LIMIT $2 OFFSET $1');
  out = out.replace(/FETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY/gi, 'LIMIT $1');

  // Oracle functions -> SQLite equivalents
  out = out.replace(/\bNVL\s*\(/gi, 'IFNULL(');
  out = out.replace(/\bSYSDATE\b/gi, "date('now')");
  for (const [ora, fmt] of TO_CHAR_FORMATS) {
    out = out.replace(new RegExp(`TO_CHAR\\s*\\(([^,]+),\\s*${ora.source}\\s*\\)`, 'gi'), `strftime(${fmt}, $1)`);
  }
  // TO_DATE('2026-01-01', 'YYYY-MM-DD') -> the literal
  out = out.replace(/TO_DATE\s*\(\s*('[^']+')\s*,\s*'[^']+'\s*\)/gi, 'date($1)');
  // ADD_MONTHS(x, -n) -> date(x, '-n months')
  out = out.replace(/ADD_MONTHS\s*\(([^,]+),\s*(-?\d+)\s*\)/gi, "date($1, '$2 months')");

  // "transaction" is a reserved word in SQLite; NetSuite uses it as a table name.
  out = out.replace(/\btransaction\b(?!line)/gi, '"transaction"');

  return out;
}

export function isReadOnly(sql) {
  return !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|PRAGMA|REPLACE)\b/i.test(sql);
}
