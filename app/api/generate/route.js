import { schemaPromptText } from '../../../lib/schema.js';
import { retrieve, bestMatch, relevantFailures } from '../../../lib/library/index.js';
import { knowledgeText } from '../../../lib/library/knowledge.js';
import { validateSuiteQL, repairInstruction } from '../../../lib/validate.js';
import { record } from '../../../lib/feedback.js';
import { enabledProviders, isRateLimit } from '../../../lib/providers.js';
import { demoExecute } from '../../../lib/demoExec.js';

// Static part of the system prompt: role, verified rules, dialect, format.
const SYSTEM_BASE = `You translate business questions about NetSuite data into SuiteQL that runs correctly against a REAL NetSuite account.

Rules:
- Return a single read-only SELECT query. Never emit DML or DDL.
- SuiteQL is Oracle-flavoured: FETCH FIRST n ROWS ONLY (not LIMIT), NVL, TO_CHAR, TO_DATE, TRUNC, ADD_MONTHS, SYSDATE. Use BUILTIN.DF(field) to display an internal id as its name.
- Prefer ANSI JOIN syntax. Alias aggregate columns with clear lowercase names.
- Every non-aggregated SELECT expression must appear in GROUP BY (no GROUP BY aliases).

${knowledgeText()}

Schema (demo-shaped; the verified rules above override any simplification here):
${schemaPromptText()}`;

// Build the per-question prompt: base + retrieved verified examples + the
// traps most likely to apply to this question.
function buildSystem(question) {
  const examples = retrieve(question, 4);
  const fails = relevantFailures(question, 3);
  let s = SYSTEM_BASE;
  if (examples.length) {
    s += '\n\nVerified example queries (proven against a real account — adapt these before inventing new SQL; keep their filters and sign handling):\n' +
      examples.map((e) => `-- ${e.intent}\n-- caveats: ${e.caveats}\n${e.sql}`).join('\n\n');
  }
  if (fails.length) {
    s += '\n\nAvoid these known mistakes:\n' +
      fails.map((f) => `- ${f.trap}: ${f.why} FIX: ${f.fix}`).join('\n');
  }
  return s;
}

const usable = (g) => typeof g?.sql === 'string' && g.sql.trim() !== '';

export async function POST(request) {
  const t0 = Date.now();
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON: { "question": "..." }' }, { status: 400 });
  }
  const question = body?.question;
  if (!question || typeof question !== 'string' || question.length > 500) {
    return Response.json({ error: 'Provide a question under 500 characters.' }, { status: 400 });
  }

  const system = buildSystem(question);
  const providers = enabledProviders();

  // Curated fallback: the best verified library query. A truthful answer to the
  // class of question, used when no provider yields usable SQL.
  const fallbackResponse = (reason) => {
    const match = bestMatch(question) || retrieve(question, 1)[0];
    if (!match) return null;
    record({ question, source: 'library', ok: true, ms: Date.now() - t0, note: reason });
    return Response.json({
      sql: match.sql,
      explanation: `Verified library query — ${match.intent}. Adapt the :placeholders (dates, ids, row count) to your needs.`,
      source: 'library',
      libraryId: match.id,
    });
  };
  const noMatch = () =>
    Response.json({ error: 'No close verified query and no AI available. Try rephrasing toward revenue, AR, vendor spend, GL, or inventory.' }, { status: 404 });

  // No providers configured → library only.
  if (providers.length === 0) return fallbackResponse('no-provider') || noMatch();

  // Try the provider chain in priority order; first usable SQL wins.
  let gen = null;
  let used = null;
  let sawRateLimit = false;
  for (const p of providers) {
    try {
      const g = await p.call(system, [{ role: 'user', content: question }]);
      if (g?.refusal) {
        record({ question, source: 'refusal', ok: false, ms: Date.now() - t0 });
        return Response.json({ error: 'The model declined this request.' }, { status: 422 });
      }
      if (usable(g)) { gen = g; used = p; break; }
      // empty output from this provider → try the next
    } catch (err) {
      if (isRateLimit(err)) sawRateLimit = true;
      console.error(`provider ${p.name} failed:`, err?.message || err);
      // continue to the next provider
    }
  }

  // Every provider failed or returned empty → verified library answer.
  if (!gen) {
    const fb = fallbackResponse(sawRateLimit ? 'all-ratelimited' : 'all-failed');
    if (fb) return fb;
    return sawRateLimit
      ? Response.json({ error: 'All providers are rate limited — try again shortly.' }, { status: 429 })
      : noMatch();
  }

  let sql = gen.sql.trim();
  let explanation = gen.explanation || '';

  // Validate statically, then EXECUTE against the demo dataset (which mirrors
  // real SuiteQL semantics). Either kind of failure earns one repair attempt
  // with the same provider; an unrepaired failure falls back to the library.
  let verdict = validateSuiteQL(sql);
  let demo = await demoExecute(sql);
  let repaired = false;
  const needsRepair = () => verdict.worst === 'critical' || (demo.tested && !demo.ok);
  if (needsRepair()) {
    const problems = [
      ...(verdict.worst === 'critical' ? [repairInstruction(verdict.issues)] : []),
      ...(demo.tested && !demo.ok
        ? [`Executing your SQL against a NetSuite-shaped test database failed with: ${demo.error}. Fix the SQL so it parses and runs.`]
        : []),
    ].join('\n');
    try {
      const fix = await used.call(system, [
        { role: 'user', content: question },
        { role: 'assistant', content: JSON.stringify({ sql, explanation }) },
        { role: 'user', content: problems },
      ]);
      if (usable(fix)) {
        const fixSql = fix.sql.trim();
        const reverdict = validateSuiteQL(fixSql);
        const redemo = await demoExecute(fixSql);
        if (reverdict.worst !== 'critical' && !(redemo.tested && !redemo.ok)) {
          sql = fixSql;
          explanation = fix.explanation || explanation;
          verdict = reverdict;
          demo = redemo;
          repaired = true;
        }
      }
    } catch (err) {
      console.error('repair failed:', err?.message || err);
    }
    // Still broken → a verified library query is safer than known-bad SQL.
    if (needsRepair()) return fallbackResponse('unrepaired-failure') || noMatch();
  }

  const warnings = verdict.issues.map((i) => ({ severity: i.severity, message: i.message, fix: i.fix }));
  record({ question, source: 'ai', provider: used.name, ok: verdict.ok, issues: verdict.issues, repaired, demoTested: demo.tested, demoRows: demo.rows, ms: Date.now() - t0 });
  return Response.json({
    sql, explanation, source: 'ai', provider: used.name, repaired, warnings,
    demo: demo.tested ? { ok: demo.ok, rows: demo.rows } : null,
  });
}
