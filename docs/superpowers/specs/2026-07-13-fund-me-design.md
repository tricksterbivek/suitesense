# Support SuiteSense Funding Link — Design

**Date:** 2026-07-13
**Status:** Approved in session (owner picked the wording and placement; URL provided and verified)

## Goal

Let visitors fund SuiteSense's LLM costs (a stronger model) through a hosted donation page. No payment processing code enters the app — the site only links out.

## Decision record

- **Platform: Buy Me a Coffee** — `https://buymeacoffee.com/tricksterbivek` (created by the owner; verified HTTP 200 on 2026-07-13). Chosen because donors arrive mostly from LinkedIn — NetSuite consultants and finance people who may not have GitHub accounts. Buy Me a Coffee accepts any card/PayPal with no donor account, sets up in minutes with an AUD Stripe payout, and the CTA is universally understood. GitHub Sponsors (0% fee) can be added later; the URL lives in one constant, so a swap is a one-line change.
- **UI: compact topbar pill, wording "❤️ Support SuiteSense"** — the owner liked the "Support SuiteSense" wording from the support-card option but wants it as an icon + label in the topbar, placed right after the "Built with ❤️ By Trickster" byline.
- **Explicitly excluded (YAGNI):** landing-page support card, hero subline, Buy Me a Coffee floating widget script (third-party JS + tracking), click analytics, automated tests for a static anchor.

## Components

### `app/components/SupportLink.js` (new)

- Holds `const FUND_URL = 'https://buymeacoffee.com/tricksterbivek'` — the single place the funding URL exists.
- Default export renders exactly one element:
  ```jsx
  <a
    className="support-pill"
    href={FUND_URL}
    target="_blank"
    rel="noreferrer"
    title="Fund a better AI model for SuiteSense"
  >
    ❤️ Support SuiteSense
  </a>
  ```
- Plain server-compatible component: no `'use client'`, no state, no props, no dependencies. The heart is the emoji already used by the adjacent byline — no new icon path needed.

### `app/globals.css` (modify)

- New `.support-pill` class: compact rounded pill styled with the existing accent design tokens — thin accent border, subtle background tint, gentle hover brighten, same font size as `.byline`. It must stay compact enough that the topbar's existing wrapping behavior on narrow screens (~375px) is unchanged.

### `app/page.js` (modify)

- Import `SupportLink`; render it as the **last** child of `.topbar-right`, immediately after the "Built with ❤️ By Trickster" anchor (currently ends near line 232).

### `app/library/page.js` (modify)

- Import `SupportLink`; render it as the **last** child of `.topbar-right`, after the "← Console" link, so both pages carry the pill consistently.

## Data flow

Static anchor → external hosted donation page. Nothing else. No state, no API, no script.

## Error handling

None required — a static link cannot fail at runtime. The dead-link risk was closed before design approval by verifying the URL resolves (HTTP 200).

## Testing / verification

- `npm run check` still passes (unaffected, cheap to run).
- `npm run build` passes.
- Manual: pill renders on `/` and `/library`, opens the Buy Me a Coffee page in a new tab, tooltip reads "Fund a better AI model for SuiteSense", topbar layout intact at ~375px width.

## Rollout

Branch `feat/support-link` → PR → merge to `main` → `vercel deploy --prod --yes`. No environment variables, no migrations.
