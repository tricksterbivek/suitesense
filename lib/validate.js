// Server-side SuiteQL validation. Catches the documented real-NetSuite traps
// in generated SQL before it reaches the user, so the same mistakes cannot
// ship again. Returns structured issues; the route decides whether to repair,
// warn, or fall back. Pure + synchronous so it is trivially testable.
import { FAILURES } from './library/index.js';
import { SCHEMA_FACTS } from './library/knowledge.js';

// Strip string literals and line comments so detectors don't match inside them.
function stripLiterals(sql) {
  return sql.replace(/'[^']*'/g, "''").replace(/--[^\n]*/g, '');
}

// Each issue: { id, severity, message, fix }. severity: 'critical' | 'major' | 'minor'.
export function validateSuiteQL(sql) {
  const issues = [];
  const bare = stripLiterals(sql);

  // 1. Failure-catalog regex detectors (status-word, subsidiary, offset, ...).
  for (const f of FAILURES) {
    if (!f.detect) continue;
    let re;
    try {
      re = new RegExp(f.detect, 'i');
    } catch {
      continue; // a malformed detector must never break generation
    }
    // status-word and territory detectors are meaningful even inside literals;
    // others (netamount/subsidiary/offset) should ignore string contents.
    const target = f.id === 'F-STATUS-WORD' ? sql : bare;
    if (re.test(target)) {
      issues.push({ id: f.id, severity: f.severity, message: f.trap, fix: f.fix });
    }
  }

  // 2. NOT_EXPOSED fields (belt-and-suspenders with F-TXN-SUBSIDIARY).
  for (const { table, field, use } of SCHEMA_FACTS.notExposed) {
    const re = new RegExp(`\\b(${table}|\\w+)\\.${field}\\b`, 'i');
    // only flag when the token actually looks like the exposed table's column
    if (new RegExp(`\\bt\\.${field}\\b|\\b${table}\\.${field}\\b`, 'i').test(bare)) {
      issues.push({
        id: `NOT_EXPOSED_${field}`,
        severity: 'critical',
        message: `${table}.${field} is NOT_EXPOSED for SuiteQL and will error`,
        fix: `Use ${use} instead`,
      });
    }
  }

  // 3. Line-sum without mainline guard: summing a transactionline measure
  //    while querying transactionline but never restricting mainline.
  const sumsLineMeasure = /SUM\s*\(\s*-?\s*\w*\.?(netamount|quantity)\s*\)/i.test(bare);
  const touchesLines = /\btransactionline\b/i.test(bare);
  const hasMainlineGuard = /\bmainline\b/i.test(bare);
  if (sumsLineMeasure && touchesLines && !hasMainlineGuard) {
    issues.push({
      id: 'F-NO-MAINLINE',
      severity: 'critical',
      message: 'Summing a transactionline measure without a mainline filter mixes header/tax/pseudo lines',
      fix: "Add mainline='F' AND taxline='F' and negate the measure (-netamount).",
    });
  }

  const worst = issues.reduce(
    (acc, i) => (i.severity === 'critical' ? 'critical' : acc === 'critical' ? 'critical' : i.severity),
    null,
  );
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
