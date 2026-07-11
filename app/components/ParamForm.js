'use client';

import { detectParams } from '../../lib/translate.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Sensible defaults: trailing 12 months, top 10, current period. Only the
// placeholders actually present in the query are returned.
export function defaultParamValues(forSql) {
  const now = new Date();
  // local-date ISO (toISOString would shift across the UTC boundary)
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yearAgo = new Date(now);
  yearAgo.setMonth(yearAgo.getMonth() - 11);
  yearAgo.setDate(1);
  const defaults = {
    start: iso(yearAgo),
    end: iso(now),
    n: '10',
    threshold: '100',
    period: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    acctnumber: '',
  };
  const present = detectParams(forSql).map((p) => p.name);
  return Object.fromEntries(Object.entries(defaults).filter(([k]) => present.includes(k)));
}

// Inline fill-in form for SuiteQL :placeholders. Deterministic by design: the
// placeholder vocabulary is a closed set (see PARAM_META), so every input has
// a precise label, type and example — nothing for the user to guess.
export default function ParamForm({ params, values, onChange, note }) {
  if (!params.length) return null;
  return (
    <div className="param-form" role="group" aria-label="Query values">
      <p className="param-form-title">Fill in the values for this query</p>
      <div className="param-fields">
        {params.map((p) => (
          <label key={p.name} className="param-field" title={p.description}>
            <span className="param-label">{p.label}</span>
            <input
              type={p.type === 'number' ? 'number' : p.type === 'date' ? 'date' : 'text'}
              value={values[p.name] ?? ''}
              placeholder={p.example}
              onChange={(e) => onChange({ ...values, [p.name]: e.target.value })}
              aria-label={`${p.label} — ${p.description}`}
            />
            <span className="param-hint">{p.description}</span>
          </label>
        ))}
      </div>
      {note && <p className="param-note">{note}</p>}
    </div>
  );
}
