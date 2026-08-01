/**
 * MSW request handlers — serve fixture JSON for every REST endpoint.
 *
 * Current-round handlers build timestamps dynamically so the round is
 * always Open when the page loads, regardless of when that happens.
 * History/settled fixtures keep their original timestamps.
 */
import { http, HttpResponse } from "msw";

import roundSettledUp from "./fixtures/round-settled-up.json";
import roundSettledDown from "./fixtures/round-settled-down.json";
import roundVoid from "./fixtures/round-void.json";
import roundLocked from "./fixtures/round-locked.json";
import userClaimable from "./fixtures/user-claimable.json";
import leaderboard from "./fixtures/leaderboard.json";
import stats from "./fixtures/stats.json";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// ── Live round builder ────────────────────────────────────────────────────────
// Timestamps are computed at request time so the round is always Open.
// lock_ts = now + 180s (3-minute betting window)
// settle_ts = now + 300s (5-minute total round)

const LOCK_OFFSET = 180;   // seconds — 3-minute betting window
const SETTLE_OFFSET = 300; // seconds — 5-minute total round

const STRIKE_PRICES: Record<string, string> = {
  BTC: "6303831631126319160",  // ~$63,038
  ETH: "186758276062184737",   // ~$1,867
  SOL: "7289616892463599",     // ~$72.89
  XLM: "13000000000000",       // ~$0.1300
};

const ROUND_IDS: Record<string, string> = {
  BTC: "42",
  ETH: "52",
  SOL: "62",
  XLM: "72",
};

const POOL_DEFAULTS: Record<string, { pool_up: string; pool_down: string }> = {
  BTC: { pool_up: "8000000000", pool_down: "2000000000" },
  ETH: { pool_up: "3200000000", pool_down: "1800000000" },
  SOL: { pool_up: "5000000000", pool_down: "2000000000" },
  XLM: { pool_up: "1500000000", pool_down: "900000000" },
};

function liveRound(asset: string) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    round_id: ROUND_IDS[asset] ?? "99",
    asset,
    strike: STRIKE_PRICES[asset] ?? "0",
    strike_ts: nowSec,
    lock_ts: nowSec + LOCK_OFFSET,
    settle_ts: nowSec + SETTLE_OFFSET,
    status: "Open",
    outcome: null,
    settle_price: null,
    created_at: new Date().toISOString(),
    settled_at: null,
    ...(POOL_DEFAULTS[asset] ?? { pool_up: "0", pool_down: "0" }),
  };
}

// Settled history per asset (fixed timestamps are fine for history)
const historyByAsset: Record<string, unknown[]> = {
  BTC: [roundSettledUp, roundSettledDown, roundVoid, roundSettledUp],
  ETH: [roundSettledDown, roundSettledUp, roundVoid],
  SOL: [roundSettledUp, roundVoid, roundSettledDown],
  XLM: [roundVoid, roundSettledUp, roundSettledDown],
};

// Indexed rounds for /api/rounds/:id
const roundsById: Record<string, unknown> = {
  [roundSettledUp.round_id]: roundSettledUp,
  [roundSettledDown.round_id]: roundSettledDown,
  [roundVoid.round_id]: roundVoid,
  [roundLocked.round_id]: roundLocked,
};

export const handlers = [
  // GET /api/rounds/current?asset=BTC
  // Returns a live Open round with timestamps computed right now.
  http.get(`${API}/api/rounds/current`, ({ request }) => {
    const asset = new URL(request.url).searchParams.get("asset")?.toUpperCase() ?? "BTC";
    return HttpResponse.json([liveRound(asset)]);
  }),

  // GET /api/rounds/history?asset=BTC&limit=50
  http.get(`${API}/api/rounds/history`, ({ request }) => {
    const asset = new URL(request.url).searchParams.get("asset")?.toUpperCase() ?? "BTC";
    const history = historyByAsset[asset] ?? historyByAsset["BTC"];
    return HttpResponse.json(history);
  }),

  // GET /api/rounds/:id
  http.get(`${API}/api/rounds/:id`, ({ params }) => {
    const id = params["id"] as string;
    // Live current rounds resolve dynamically
    if (Object.values(ROUND_IDS).includes(id)) {
      const asset = Object.entries(ROUND_IDS).find(([, v]) => v === id)?.[0] ?? "BTC";
      return HttpResponse.json(liveRound(asset));
    }
    const round = roundsById[id];
    if (!round) return HttpResponse.json({ error: "not found" }, { status: 404 });
    return HttpResponse.json(round);
  }),

  // GET /api/users/:address/positions
  http.get(`${API}/api/users/:address/positions`, () => {
    const nowSec = Math.floor(Date.now() / 1000);
    return HttpResponse.json([
      {
        id: 1,
        tx_hash: "abc123",
        event_index: 0,
        round_id: "38",
        user_addr: "GBGCQGIFNIPDRZ6GN5CFSW5T5KCTGLXDY5HD7ISY6EBDVU7Q2YFBDXUJ",
        side: "Up",
        amount: "1000000000",
        placed_at: new Date(Date.now() - 600_000).toISOString(),
        asset: "BTC",
        status: "Settled",
        outcome: "Up",
        settle_ts: nowSec - 300,
        pool_up: "8000000000",
        pool_down: "2000000000",
        strike: "6303831631126319160",
        settle_price: "6400000000000000000",
      },
      {
        id: 2,
        tx_hash: "def456",
        event_index: 0,
        round_id: ROUND_IDS["BTC"],
        user_addr: "GBGCQGIFNIPDRZ6GN5CFSW5T5KCTGLXDY5HD7ISY6EBDVU7Q2YFBDXUJ",
        side: "Down",
        amount: "500000000",
        placed_at: new Date(Date.now() - 60_000).toISOString(),
        asset: "BTC",
        status: "Open",
        outcome: null,
        settle_ts: nowSec + SETTLE_OFFSET,
        pool_up: "8000000000",
        pool_down: "2000000000",
        strike: STRIKE_PRICES["BTC"],
        settle_price: null,
      },
    ]);
  }),

  // GET /api/users/:address/claimable
  http.get(`${API}/api/users/:address/claimable`, () => {
    return HttpResponse.json(userClaimable);
  }),

  // GET /api/leaderboard
  http.get(`${API}/api/leaderboard`, () => {
    return HttpResponse.json(leaderboard);
  }),

  // GET /api/stats
  http.get(`${API}/api/stats`, () => {
    return HttpResponse.json(stats);
  }),

  // GET /health
  http.get(`${API}/health`, () => {
    return HttpResponse.json({ ok: true, ts: Date.now() });
  }),
];
