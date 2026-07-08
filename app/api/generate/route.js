import Anthropic from '@anthropic-ai/sdk';
import { schemaPromptText } from '../../../lib/schema.js';
import { EXAMPLES, matchExample } from '../../../lib/examples.js';

const SYSTEM = `You translate business questions about NetSuite data into SuiteQL.

Rules:
- Return a single read-only SELECT query. Never emit DML or DDL.
- Use only the tables and columns in the schema below.
- SuiteQL is Oracle-flavoured: use FETCH FIRST n ROWS ONLY (not LIMIT), NVL, TO_CHAR, ADD_MONTHS, SYSDATE.
- Prefer ANSI JOIN syntax. Avoid BUILTIN.* functions — this console targets a portable subset.
- Alias aggregate columns with clear lowercase names.

Schema:
${schemaPromptText()}

Examples:
${EXAMPLES.slice(0, 4)
  .map((e) => `Q: ${e.question}\nSQL:\n${e.sql}`)
  .join('\n\n')}`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    sql: { type: 'string', description: 'The SuiteQL SELECT query' },
    explanation: { type: 'string', description: 'One sentence: what the query returns' },
  },
  required: ['sql', 'explanation'],
  additionalProperties: false,
};

export async function POST(request) {
  const { question } = await request.json();
  if (!question || typeof question !== 'string' || question.length > 500) {
    return Response.json({ error: 'Provide a question under 500 characters.' }, { status: 400 });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic();
    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        system: SYSTEM,
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        messages: [{ role: 'user', content: question }],
      });

      if (response.stop_reason === 'refusal') {
        return Response.json({ error: 'The model declined this request.' }, { status: 422 });
      }
      const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
      const { sql, explanation } = JSON.parse(text);
      return Response.json({ sql, explanation, source: 'ai' });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        return Response.json({ error: 'Rate limited — try again shortly.' }, { status: 429 });
      }
      console.error('generate failed:', err);
      return Response.json({ error: 'Generation failed.' }, { status: 500 });
    }
  }

  if (process.env.GEMINI_API_KEY) {
    // ponytail: plain fetch, no SDK dep. Any failure (incl. free-tier 429)
    // falls through to the curated examples below.
    try {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{
                text: `${SYSTEM}\n\nRespond with only a JSON object: {"sql": "...", "explanation": "..."} where explanation is one sentence describing what the query returns.`,
              }],
            },
            contents: [{ role: 'user', parts: [{ text: question }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        },
      );
      if (r.ok) {
        const data = await r.json();
        const { sql, explanation } = JSON.parse(
          data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}',
        );
        if (sql) return Response.json({ sql, explanation, source: 'ai' });
      } else {
        console.error('gemini error:', r.status, await r.text());
      }
    } catch (err) {
      console.error('gemini failed:', err);
    }
  }

  const example = matchExample(question);
  return Response.json({
    sql: example.sql,
    explanation: '',
    source: 'examples',
  });
}
