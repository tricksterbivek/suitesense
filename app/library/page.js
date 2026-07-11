import Link from 'next/link';
import { QUERIES, CATEGORIES } from '../../lib/library/index.js';
import LibraryBrowser from './browser.js';

export const metadata = {
  title: 'Query Library — SuiteSense',
  description: 'Browse verified, tested SuiteQL queries for real NetSuite reporting.',
};

export default function LibraryPage() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand" style={{ textDecoration: 'none' }}>
          <span className="brand-logo">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </span>
          SuiteSense
          <span className="brand-sub">Query Library</span>
        </Link>
        <div className="topbar-right">
          <Link className="byline" href="/">← Console</Link>
        </div>
      </header>

      <main>
        <section className="lib-hero">
          <h1>Verified SuiteQL Library</h1>
          <p>
            {QUERIES.length} proven query patterns — each executed successfully against a real
            NetSuite account. Search, copy, and adapt them for reliable reporting, or let the
            console retrieve them for you.
          </p>
        </section>
        <LibraryBrowser queries={QUERIES} categories={CATEGORIES} />
      </main>
    </div>
  );
}
