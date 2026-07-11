// Server-side SuiteQL validation. Catches the documented real-NetSuite traps
// in generated SQL before it reaches the user, so the same mistakes cannot
// ship again. Returns structured issues; the route decides whether to repair,
// warn, or fall back. Pure + synchronous so it is trivially testable.
//
// Detection is best-effort (regex + light alias resolution, not a full parser)
// but is careful in two ways the review flagged: comments are stripped BEFORE
// string literals (an apostrophe in a comment must not swallow real SQL), and
// table-qualified checks resolve the actual alias bound to each table rather
// than assuming `t`.
import { FAILURES } from './library/index.js';
import { SCHEMA_FACTS } from './library/knowledge.js';

const SEV_RANK = { critical: 0, major: 1, minor: 2 };

// Remove line comments first, then string literals ('' escapes preserved).
function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '');
}
function stripLiterals(sql) {
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

// Map each occurrence of a base table to the alias it is bound to in FROM/JOIN.
// Returns e.g. { transaction: ['t'], transactionline: ['tl'] } (aliases, plus
// the bare table name itself so `transaction.x` is always covered).
function aliasesFor(sqlNoComments, table) {
  const out = new Set([table]);
  const re = new RegExp(`\\b(?:from|join)\\s+${table}\\s+(?:as\\s+)?(\\w+)`, 'gi');
  let m;
  while ((m = re.exec(sqlNoComments))) {
    if (m[1] && m[1].toLowerCase() !== 'on' && m[1].toLowerCase() !== 'where') out.add(m[1]);
  }
  return [...out];
}

// Does the query reference <alias>.<field> for any alias bound to `table`,
// while NOT being an alias bound to `excludeTable`? Used so transactionline
// aliased as `t` is not mistaken for the transaction header.
function referencesField(bare, aliases, field) {
  return aliases.some((a) => new RegExp(`\\b${a}\\.${field}\\b`, 'i').test(bare));
}

// Each issue: { id, severity, message, fix }.
export function validateSuiteQL(sql) {
  if (typeof sql !== 'string' || sql.trim() === '') {
    return { ok: false, issues: [{ id: 'EMPTY', severity: 'critical', message: 'No SQL was produced', fix: 'Regenerate the query.' }], worst: 'critical' };
  }
  const issues = [];
  const noComments = stripComments(sql);
  const bare = stripLiterals(noComments); // comments gone, literals blanked

  const txnAliases = aliasesFor(noComments, 'transaction');
  const lineAliases = aliasesFor(noComments, 'transactionline');
  // aliases that are transaction-header only (not also a transactionline alias)
  const headerOnly = txnAliases.filter((a) => !lineAliases.includes(a));

  // 1. Failure-catalog regex detectors that are alias-independent
  //    (status word, territory, offset). Alias-sensitive traps are handled
  //    structurally below, so their catalog `detect` is null.
  for (const f of FAILURES) {
    if (!f.detect) continue;
    let re;
    try { re = new RegExp(f.detect, 'i'); } catch { continue; }
    // status-word matches a literal value, so it must see literals (but not
    // comments); everything else runs against the fully-blanked `bare`.
    const target = f.id === 'F-STATUS-WORD' ? noComments : bare;
    if (re.test(target)) issues.push({ id: f.id, severity: f.severity, message: f.trap, fix: f.fix });
  }

  // 2. NOT_EXPOSED header fields (e.g. transaction.subsidiary) — flag only when
  //    referenced via a transaction-header alias, never a transactionline one.
  for (const { table, field, use } of SCHEMA_FACTS.notExposed) {
    if (table !== 'transaction') continue;
    if (headerOnly.length && referencesField(bare, headerOnly, field)) {
      issues.push({
        id: `NOT_EXPOSED_${field}`,
        severity: 'critical',
        message: `transaction.${field} is NOT_EXPOSED for SuiteQL and will error`,
        fix: `Use ${use} instead`,
      });
    }
  }

  // 3. transactionline measure sums: must negate and must filter mainline='F'.
  if (lineAliases.length) {
    // a SUM over netamount/quantity qualified by a transactionline alias
    const measureRe = (agg) =>
      new RegExp(`SUM\\s*\\(\\s*(-?)\\s*(?:${lineAliases.map((a) => a + '\\.').join('|')})?(netamount|quantity)\\b`, 'i');
    const m = bare.match(measureRe());
    if (m) {
      const negated = m[1] === '-';
      const hasMainlineF = /\bmainline\s*=\s*''/.test(bare); // literal 'F' blanked to ''
      if (!hasMainlineF) {
        issues.push({
          id: 'F-NO-MAINLINE',
          severity: 'critical',
          message: 'Summing a transactionline measure without a mainline filter mixes header/tax/pseudo lines',
          fix: "Add mainline='F' AND taxline='F' (and constrain itemtype to real products).",
        });
      }
      if (!negated) {
        issues.push({
          id: 'F-LINE-SIGN',
          severity: 'critical',
          message: 'Sales transactionline netamount/quantity are negative; sum is wrong-signed',
          fix: 'Negate the measure: SUM(-tl.netamount).',
        });
      }
    }
  }

  // Worst severity, rank-ordered (not order-of-appearance).
  const worst = issues.reduce((acc, i) => {
    if (acc === null) return i.severity;
    return SEV_RANK[i.severity] < SEV_RANK[acc] ? i.severity : acc;
  }, null);
  return { ok: issues.length === 0, issues, worst };
}

// A compact string the generation layer can hand back to the model for a
// single repair attempt.
export function repairInstruction(issues) {
  return (
    'Your SuiteQL has verified real-NetSuite problems. Fix ALL of these and return corrected SQL:\n' +
    issues.map((i) => `- [${i.severity}] ${i.message}. ${i.fix}`).join('\n')
  );
}
