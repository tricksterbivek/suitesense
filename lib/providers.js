// LLM provider chain. Generation tries enabled providers in priority order and
// uses the first that returns usable SQL, so a rate-limited or down provider
// falls through to the next instead of failing the request. Groq, Cerebras and
// OpenRouter are OpenAI-compatible and share one caller (DRY); Anthropic and
// Gemini keep their native shapes.
//
// Every provider is opt-in by env var, and every model is env-overridable so
// tuning needs no code change. Order is controlled by PROVIDER_ORDER (a
// comma-separated list) or the sensible default below.
import Anthropic from '@anthropic-ai/sdk';

// Lenient JSON extraction — some models wrap output in ```json fences or prose.
function extractJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

function jsonInstruction(system) {
  return `${system}\n\nRespond with ONLY a JSON object: {"sql": "<the SuiteQL SELECT>", "explanation": "<one sentence>"}. No markdown, no prose outside the JSON.`;
}

// --- Anthropic (native Messages API, structured output) ---
async function callAnthropic(system, messages) {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: { sql: { type: 'string' }, explanation: { type: 'string' } },
          required: ['sql', 'explanation'],
          additionalProperties: false,
        },
      },
    },
    messages,
  });
  if (response.stop_reason === 'refusal') return { refusal: true };
  return extractJson(response.content.find((b) => b.type === 'text')?.text ?? '{}');
}

// --- Gemini (native generateContent) ---
async function callGemini(system, messages) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: jsonInstruction(system) }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    },
  );
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const data = await r.json();
  return extractJson(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}');
}

// --- OpenAI-compatible providers (Groq, Cerebras, OpenRouter) ---
const OPENAI_COMPAT = {
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    env: 'OPENROUTER_API_KEY',
    model: () => process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    extraHeaders: { 'HTTP-Referer': 'https://suitesense.vercel.app', 'X-Title': 'SuiteSense' },
  },
  cerebras: {
    url: 'https://api.cerebras.ai/v1/chat/completions',
    env: 'CEREBRAS_API_KEY',
    model: () => process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    env: 'GROQ_API_KEY',
    model: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  },
};

function makeOpenAICompatCaller(name) {
  const p = OPENAI_COMPAT[name];
  return async (system, messages) => {
    const r = await fetch(p.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env[p.env]}`,
        ...(p.extraHeaders || {}),
      },
      body: JSON.stringify({
        model: p.model(),
        messages: [{ role: 'system', content: jsonInstruction(system) }, ...messages],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
    if (!r.ok) throw new Error(`${name} ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const data = await r.json();
    return extractJson(data.choices?.[0]?.message?.content ?? '{}');
  };
}

// Registry: name -> { env, call }. Order below is the default priority.
const REGISTRY = {
  anthropic: { env: 'ANTHROPIC_API_KEY', call: callAnthropic },
  openrouter: { env: 'OPENROUTER_API_KEY', call: makeOpenAICompatCaller('openrouter') },
  cerebras: { env: 'CEREBRAS_API_KEY', call: makeOpenAICompatCaller('cerebras') },
  groq: { env: 'GROQ_API_KEY', call: makeOpenAICompatCaller('groq') },
  gemini: { env: 'GEMINI_API_KEY', call: callGemini },
};
// Speed/cost first: fast free inference (Cerebras, Groq, Gemini) leads; the
// paid OpenRouter backstop is last. Anthropic stays first when its key exists.
// The validator + verified library keep even a fast model's output correct.
const DEFAULT_ORDER = ['anthropic', 'cerebras', 'groq', 'gemini', 'openrouter'];

// Enabled providers in priority order (only those whose key is present).
export function enabledProviders() {
  const order = (process.env.PROVIDER_ORDER || DEFAULT_ORDER.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter((n) => REGISTRY[n]);
  return order
    .filter((n) => process.env[REGISTRY[n].env])
    .map((n) => ({ name: n, call: REGISTRY[n].call }));
}

export const isRateLimit = (err) => err instanceof Anthropic.RateLimitError || /\b429\b|rate.?limit/i.test(String(err?.message || err));
