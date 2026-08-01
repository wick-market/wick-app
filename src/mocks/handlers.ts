/**
 * MSW request handlers — serve fixture JSON for every REST endpoint.
 * The same fetch() calls used in real mode are intercepted here in mock mode.
 */
import { http, HttpResponse } from "msw";

// Fixtures
import roundsCurrentBtc from "./fixtures/rounds-current-btc.json";
import roundSettledUp from "./fixtures/round-settled-up.json";
import roundSettledDown from "./fixtures/round-settled-down.json";
import roundVoid from "./fixtures/round-void.json";
import roundLocked from "./fixtures/round-locked.json";
import userClaimable from "./fixtures/user-claimable.json";
import leaderboard from "./fixtures/leaderboard.json";
import stats from "./fixtures/stats.json";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// Per-asset current rounds (reuse BTC fixture for all; enough for dev)
const currentRoundsByAsset: Record<string, unknown[]> = {
  BTC: roundsCurrentBtc,
  ETH: [
    {
      ...roundsCurrentBtc[0],
      round_id: "52",
      asset: "ETH",
      strike: "186758276062184737",
      pool_up: "3200000000",
      pool_down: "1800000000",
    },
  ],
  SOL: [
    {
      ...roundsCurrentBtc[0],
      round_id: "62",
      asset: "SOL",
      strike: "7289616892463599",
      pool_up: "5000000000",
      pool_down: "2000000000",
    },
  ],
};

// Settled history per asset (mix of outcomes)
const historyByAsset: Record<string, unknown[]> = {
  BTC: [roundSettledUp, roundSettledDown, roundVoid, roundSettledUp],
  ETH: [roundSettledDown, roundSettledUp, roundVoid],
  SOL: [roundSettledUp, roundVoid, roundSettledDown],
};

// Indexed rounds for /api/rounds/:id
const roundsById: Record<string, unknown> = {
  [roundSettledUp.round_id]: roundSettledUp,
  [roundSettledDown.round_id]: roundSettledDown,
  [roundVoid.round_id]: roundVoid,
  [roundLocked.round_id]: roundLocked,
  "42": roundsCurrentBtc[0],
};

export const handlers = [
  // GET /api/rounds/current?asset=BTC
  http.get(`${API}/api/rounds/current`, ({ request }) => {
    const asset = new URL(request.url).searchParams.get("asset")?.toUpperCase() ?? "BTC";
    const rounds = currentRoundsByAsset[asset] ?? currentRoundsByAsset["BTC"];
    return HttpResponse.json(rounds);
  }),

  // GET /api/rounds/history?asset=BTC&limit=50
  http.get(`${API}/api/rounds/history`, ({ request }) => {
    const asset = new URL(request.url).searchParams.get("asset")?.toUpperCase() ?? "BTC";
    const history = historyByAsset[asset] ?? historyByAsset["BTC"];
    return HttpResponse.json(history);
  }),

  // GET /api/rounds/:id
  http.get(`${API}/api/rounds/:id`, ({ params }) => {
    const round = roundsById[params["id"] as string];
    if (!round) return HttpResponse.json({ error: "not found" }, { status: 404 });
    return HttpResponse.json(round);
  }),

  // GET /api/users/:address/positions
  http.get(`${API}/api/users/:address/positions`, () => {
    // Return a mix of positions across assets and statuses
    return HttpResponse.json([
      {
        id: 1,
        tx_hash: "abc123",
        event_index: 0,
        round_id: "38",
        user_addr: "GBGCQGIFNIPDRZ6GN5CFSW5T5KCTGLXDY5HD7ISY6EBDVU7Q2YFBDXUJ",
        side: "Up",
        amount: "1000000000",
        placed_at: "2026-08-01T10:10:30.000Z",
        asset: "BTC",
        status: "Settled",
        outcome: "Up",
        settle_ts: 1785576900,
        pool_up: "8000000000",
        pool_down: "2000000000",
        strike: "6303831631126319160",
        settle_price: "6400000000000000000",
      },
      {
        id: 2,
        tx_hash: "def456",
        event_index: 0,
        round_id: "42",
        user_addr: "GBGCQGIFNIPDRZ6GN5CFSW5T5KCTGLXDY5HD7ISY6EBDVU7Q2YFBDXUJ",
        side: "Down",
        amount: "500000000",
        placed_at: "2026-08-01T10:30:10.000Z",
        asset: "BTC",
        status: "Open",
        outcome: null,
        settle_ts: 1785578100,
        pool_up: "8000000000",
        pool_down: "2000000000",
        strike: "6303831631126319160",
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
