# Contributing to wick-app

## You do not need the backend

Mock mode is on by default. `npm install && npm run dev` gives you a fully
functional app with animated rounds — no backend, no Postgres, no Rust toolchain.

---

## Local setup

```bash
git clone https://github.com/Tijesunimi004/wick-app.git
cd wick-app
npm install
npm run dev         # http://localhost:3000
```

No `.env` file needed. `NEXT_PUBLIC_MOCK=true` is the default in `next.config.mjs`.

---

## How mock mode works

`NEXT_PUBLIC_MOCK=true` enables two things:

**MSW** (`src/mocks/browser.ts`) intercepts every `fetch()` call and returns
fixture JSON. The same component code that runs against the real API runs in
mock mode — there is no mock-specific branch in components.

Critically, the MSW handlers build round timestamps dynamically at request
time (`liveRound()` in `handlers.ts`), so rounds are always Open when the
page loads. The 3-minute countdown is live from the moment you open the browser.

**Mock clock** (`src/mocks/mock-clock.ts`) simulates the WebSocket feed in real
time. A fresh Open round starts on page load. After 3 minutes, it transitions
to Locked. After 5 minutes, it settles. The clock loops so you can watch the
full cycle repeat.

Bet and claim calls in mock mode simulate a 1.5-second delay and return
success — the wallet kit is not invoked, so no Freighter extension is needed.

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

- `"use client"` at the top of any component that uses `useState`, `useEffect`, or browser APIs
- Monetary amounts are always `bigint` (stroops) — never `number` or `float`
- Oracle prices are `string` (raw i128 with 14 decimal places) — format via `src/lib/domain/format.ts`
- Phase logic lives in `src/lib/domain/round.ts` — call `getPhase()` there, don't re-derive it
- The provisional odds label in `ProvisionalOdds.tsx` is a correctness requirement — do not remove it

---

## Commands

```bash
npm run dev           # start dev server (mock mode on by default)
npm run typecheck     # TypeScript
npm run lint          # ESLint
npm run format        # Prettier
npm run format:check  # check formatting (used in CI)
npm run build         # production build
```
