import assert from 'node:assert';

// Isolate env so the test is deterministic.
for (const k of ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'PROVIDER_ORDER']) {
  delete process.env[k];
}

const { enabledProviders } = await import('./providers.js');

// No keys → empty chain (route then serves the library).
assert.deepEqual(enabledProviders(), [], 'no keys → no providers');

// Keys present → default priority order, only for keys that exist.
process.env.GROQ_API_KEY = 'x';
process.env.CEREBRAS_API_KEY = 'x';
process.env.GEMINI_API_KEY = 'x';
assert.deepEqual(
  enabledProviders().map((p) => p.name),
  ['cerebras', 'groq', 'gemini'],
  'default order: cerebras, groq, gemini (anthropic/openrouter skipped without keys)',
);

// PROVIDER_ORDER overrides and filters unknown/keyless names.
process.env.PROVIDER_ORDER = 'groq, nonsense, gemini, cerebras';
assert.deepEqual(
  enabledProviders().map((p) => p.name),
  ['groq', 'gemini', 'cerebras'],
  'explicit order honoured, unknown names dropped',
);

// Anthropic leads when its key exists.
process.env.PROVIDER_ORDER = '';
process.env.ANTHROPIC_API_KEY = 'x';
assert.equal(enabledProviders()[0].name, 'anthropic', 'anthropic leads when keyed');

console.log('providers: all checks passed');
