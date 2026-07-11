import Anthropic from '@anthropic-ai/sdk';
import { schemaPromptText } from '../../../lib/schema.js';
import { retrieve, bestMatch, relevantFailures } from '../../../lib/library/index.js';
import { knowledgeText } from '../../../lib/library/knowledge.js';
import { validateSuiteQL, repairInstruction } from '../../../lib/validate.js';
import { record } from '../../../lib/feedback.js';

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

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    sql: { type: 'string', description: 'The SuiteQL SELECT query' },
    explanation: { type: 'string', description: 'One sentence: what the query returns' },
  },
  required: ['sql', 'explanation'],
  additionalProperties: false,
};

async function callAnthropic(client, system, messages) {
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system,
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages,
  });
  if (response.stop_reason === 'refusal') return { refusal: true };
  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  return JSON.parse(text);
}

async function callGemini(system, question) {
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: `${system}\n\nRespond with only a JSON object: {"sql": "...", "explanation": "..."} where explanation is one sentence describing what the query returns.` }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  );
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}');
}

export async function POST(request) {
  const t0 = Date.now();
  const { question } = await request.json();
  if (!question || typeof question !== 'string' || question.length > 500) {
    return Response.json({ error: 'Provide a question under 500 characters.' }, { status: 400 });
  }

  const system = buildSystem(question);
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  // Curated fallback: the best verified library query. Beats free-form when we
  // have no model, and is a truthful answer to the class of question.
  const fallback = () => {
    const match = bestMatch(question) || retrieve(question, 1)[0];
    if (!match) return null;
    return {
      sql: match.sql,
      explanation: `Verified library query — ${match.intent}. Adapt the :placeholders (dates, ids, row count) to your needs.`,
      source: 'library',
      libraryId: match.id,
    };
  };

  if (hasAnthropic || hasGemini) {
    try {
      let gen;
      if (hasAnthropic) {
        const client = new Anthropic();
        gen = await callAnthropic(client, system, [{ role: 'user', content: question }]);
        if (gen.refusal) return Response.json({ error: 'The model declined this request.' }, { status: 422 });
      } else {
        gen = await callGemini(system, question);
      }

      // Validate. One repair attempt if a critical trap slipped through.
      let { sql, explanation } = gen;
      let verdict = validateSuiteQL(sql);
      let repaired = false;
      if (verdict.worst === 'critical' && sql) {
        try {
          const fix = hasAnthropic
            ? await callAnthropic(new Anthropic(), system, [
                { role: 'user', content: question },
                { role: 'assistant', content: JSON.stringify({ sql, explanation }) },
                { role: 'user', content: repairInstruction(verdict.issues) },
              ])
            : await callGemini(system + '\n\n' + repairInstruction(verdict.issues), question);
          if (fix.sql) {
            const reverdict = validateSuiteQL(fix.sql);
            if (reverdict.worst !== 'critical') {
              sql = fix.sql;
              explanation = fix.explanation || explanation;
              verdict = reverdict;
              repaired = true;
            }
          }
        } catch { /* keep original + surface warnings */ }
      }

      const warnings = verdict.issues.map((i) => ({ severity: i.severity, message: i.message, fix: i.fix }));
      record({ question, source: 'ai', ok: verdict.ok, issues: verdict.issues, repaired, ms: Date.now() - t0 });
      return Response.json({ sql, explanation, source: 'ai', repaired, warnings });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        return Response.json({ error: 'Rate limited — try again shortly.' }, { status: 429 });
      }
      console.error('generate failed:', err);
      // fall through to the verified-library fallback rather than error out
      const fb = fallback();
      if (fb) {
        record({ question, source: 'library', ok: true, ms: Date.now() - t0 });
        return Response.json(fb);
      }
      return Response.json({ error: 'Generation failed.' }, { status: 500 });
    }
  }

  const fb = fallback();
  if (fb) {
    record({ question, source: 'library', ok: true, ms: Date.now() - t0 });
    return Response.json(fb);
  }
  return Response.json({
    error: 'No close verified query and no AI key configured. Try rephrasing toward revenue, AR, vendor spend, GL, or inventory.',
  }, { status: 404 });
}
