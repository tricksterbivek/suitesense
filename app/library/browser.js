'use client';

import { useMemo, useState } from 'react';

function Icon({ d, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
const I = {
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  copy: ['M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  check: ['M20 6L9 17l-5-5'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  link: ['M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1', 'M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1'],
};

const WORD = /[a-z0-9]+/g;
const toks = (s) => (s.toLowerCase().match(WORD) || []);

export default function LibraryBrowser({ queries, categories }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [selId, setSelId] = useState(queries[0]?.id);
  const [copied, setCopied] = useState(null);

  const filtered = useMemo(() => {
    const words = toks(q);
    return queries
      .filter((e) => cat === 'all' || e.category === cat)
      .map((e) => {
        if (!words.length) return { e, s: 1 };
        const hay = new Set([...toks(e.intent), ...e.keywords.flatMap(toks), ...toks(e.category), ...toks(e.sql)]);
        let s = 0;
        for (const w of words) if ([...hay].some((h) => h.includes(w) || w.includes(h))) s += 1;
        return { e, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.e);
  }, [q, cat, queries]);

  const selected = filtered.find((e) => e.id === selId) || filtered[0];

  async function copy(text, id) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="lib">
      <div className="lib-controls">
        <div className="lib-search">
          <Icon d={I.search} size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by keyword, field, table, or use case — e.g. open AR, revenue by item, vendor spend"
            aria-label="Search the query library"
          />
        </div>
        <div className="lib-cats">
          <button className={cat === 'all' ? 'lib-cat on' : 'lib-cat'} onClick={() => setCat('all')}>
            all <span>{queries.length}</span>
          </button>
          {categories.map((c) => (
            <button key={c} className={cat === c ? 'lib-cat on' : 'lib-cat'} onClick={() => setCat(c)}>
              {c} <span>{queries.filter((e) => e.category === c).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lib-body">
        <ul className="lib-list" role="listbox" aria-label="Queries">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                className={selected?.id === e.id ? 'lib-item on' : 'lib-item'}
                onClick={() => setSelId(e.id)}
                role="option"
                aria-selected={selected?.id === e.id}
              >
                <span className="lib-item-intent">{e.intent}</span>
                <span className="lib-item-meta">
                  <span className="lib-tag">{e.category}</span>
                  <span className={`lib-diff d-${e.difficulty}`}>{e.difficulty}</span>
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="lib-empty">No queries match. Try fewer or different keywords.</li>}
        </ul>

        {selected && (
          <div className="lib-detail">
            <div className="lib-detail-head">
              <div>
                <span className="lib-tag">{selected.category}</span>
                <span className="lib-verified" title="Executed successfully against a real NetSuite account">
                  <Icon d={I.shield} size={13} /> Verified
                </span>
              </div>
              <h2>{selected.intent}</h2>
            </div>

            <div className="lib-sqlwrap">
              <div className="lib-sql-toolbar">
                <span className="lib-id">{selected.id}</span>
                <button className="lib-copy" onClick={() => copy(selected.sql, selected.id)}>
                  <Icon d={copied === selected.id ? I.check : I.copy} size={13} />
                  {copied === selected.id ? 'Copied' : 'Copy SuiteQL'}
                </button>
              </div>
              <pre className="lib-sql"><code>{selected.sql}</code></pre>
            </div>

            <div className="lib-facts">
              {selected.caveats && (
                <section>
                  <h3><Icon d={I.shield} size={13} /> Why it's written this way</h3>
                  <p>{selected.caveats}</p>
                </section>
              )}
              {selected.joins?.length > 0 && (
                <section>
                  <h3><Icon d={I.link} size={13} /> Joins &amp; schema</h3>
                  <ul className="lib-joins">
                    {selected.joins.map((j) => <li key={j}><code>{j}</code></li>)}
                  </ul>
                </section>
              )}
              {selected.sample_shape?.length > 0 && (
                <section>
                  <h3>Expected columns</h3>
                  <div className="lib-cols">
                    {selected.sample_shape.map((c) => <span key={c} className="lib-col">{c}</span>)}
                  </div>
                </section>
              )}
              <p className="lib-note">
                Placeholders like <code>:start</code>, <code>:end</code>, <code>:n</code>, <code>:threshold</code> are yours to fill in. This query targets a live NetSuite account (SuiteQL), not the in-browser demo.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
