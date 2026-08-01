# Contributing to wick-app

## You do not need the backend

Mock mode is on by default. `npm install && npm run dev` gives you a fully
functional app with animated rounds, no backend required.

---

## Local setup

```bash
git clone https://github.com/Tijesunimi004/wick-app.git
cd wick-app
npm install
npm run dev         # http://localhost:3000
```

No `.env` file needed. `NEXT_PUBLIC_MOCK=true` is the default in `next.config.ts`.

---

## How mock mode works

`NEXT_PUBLIC_MOCK=true` enables two things:

**1. MSW** (`src/mocks/browser.ts`) intercepts every `fetch()` call and returns
fixture JSON from `src/mocks/fixtures/`. The same component code that runs against
the real API runs here — there is no mock-specific code in components.

**2. Mock clock** (`src/mocks/mock-clock.ts`) simulates the WebSocket feed on a
**20× compressed timeline**: a 5-minute round plays out in ~15 seconds.
The clock rewrites round timestamps (lock_ts, settle_ts) to live values relative
to `Date.now()`, so `Countdown` components count down with real seconds and
transitions (Open → Locked → Settling → Settled) happen visibly.

To watch the full cycle: open the market page and wait 15 seconds.

---

## Vendored files

These files are copied from wick-protocol and must not be edited here:

| File | Source |
|---|---|
| `src/lib/api/openapi.yaml` | wick-protocol/openapi.yaml |
| `src/lib/api/types.ts` | wick-protocol/packages/types/index.ts |
| `src/lib/stellar/bindings/` | wick-protocol/packages/bindings/src/ |
| `src/mocks/fixtures/` | wick-protocol/fixtures/ |

To update vendored files: pull changes from wick-protocol, copy the relevant
files, and open a PR.

---

## Component conventions

- Every component that uses `useState`, `useEffect`, or browser APIs needs `"use client"` at the top
- Monetary amounts are always `bigint` (stroops) — never `number` or `float`
- Oracle prices are `string` (raw i128 with 14 decimal places) — format via `src/lib/domain/format.ts`
- The **provisional odds label** on `ProvisionalOdds.tsx` is a correctness requirement, not copy. Do not remove it.
- Phase logic lives in `src/lib/domain/round.ts` — if you need to know what phase a round is in, call `getPhase()` there

---

## How to claim a TODO issue

1. Find a TODO in the code (grep for `TODO: Issue #`) or check the README table
2. Comment "claiming this" on the GitHub issue
3. Create a branch: `feat/issue-N-short-description`
4. Implement the stub (each TODO has a comment explaining what's needed)
5. Open a PR — include a test or a screenshot showing it works on testnet

---

## Commands

```bash
npm run dev           # start dev server
npm run typecheck     # TypeScript — no network required
npm run lint          # ESLint
npm run format        # Prettier
npm run format:check  # check formatting (used in CI)
npm run build         # production build
```
