/**
 * Mock clock — simulates the WebSocket feed on a compressed timeline.
 *
 * SPEED_FACTOR = 20 means a real 5-minute round plays out in 15 seconds.
 * This lets contributors watch the full Open → Locked → Settling → Settled
 * cycle without waiting five real minutes.
 *
 * The clock rewrites round timestamps to be live relative to Date.now(),
 * so Countdown components work with real seconds and don't need to know
 * they're in mock mode.
 *
 * It also emits a price tick every 500ms with a small random walk,
 * independent of the round sequence.
 */

import wsSequence from "./fixtures/ws-sequence.json";

// Real-time: SPEED_FACTOR=1 means the mock runs at actual clock speed.
// Betting window = 3 minutes (180s), dead window = 2 minutes (120s), settle at 5 minutes.
// Contributors see a real 3-minute countdown exactly as users would.
const SPEED_FACTOR = 1;
const LOCK_OFFSET_SECS = 180;   // 3-minute betting window
const SETTLE_OFFSET_SECS = 300; // 5-minute total round

type WsMsg = Record<string, unknown>;
type Listener = (msg: WsMsg) => void;

const listeners = new Set<Listener>();
const timers: ReturnType<typeof setTimeout>[] = [];

// Indicative display prices — these are NOT the settlement prices.
// Settlement reads oracle.price(asset, settle_ts) from Reflector.
const indicativePrices: Record<string, number> = {
  BTC: 63038.32,
  ETH: 1867.58,
  SOL: 72.9,
  XLM: 0.1302,
};

function emit(msg: WsMsg) {
  listeners.forEach((fn) => fn(msg));
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers.length = 0;
}

function buildRoundTimestamps(nowSec: number) {
  const lockOffset = Math.ceil(LOCK_OFFSET_SECS / SPEED_FACTOR); // 180s = 3 min
  const settleOffset = Math.ceil(SETTLE_OFFSET_SECS / SPEED_FACTOR); // 300s = 5 min
  return {
    strike_ts: nowSec,
    lock_ts: nowSec + lockOffset,
    settle_ts: nowSec + settleOffset,
  };
}

// Base strike prices per asset (raw oracle i128 with 14 decimals).
const STRIKE_PRICES: Record<string, string> = {
  BTC: "6303831631126319160",
  ETH: "186758276062184737",
  SOL: "7289616892463599",
  XLM: "13000000000000",
};

// Asset-specific round IDs so the UI can distinguish them.
const ROUND_IDS: Record<string, string> = {
  BTC: "42",
  ETH: "52",
  SOL: "62",
  XLM: "72",
};

const ALL_ASSETS = ["BTC", "ETH", "SOL", "XLM"] as const;

function startLoop() {
  clearTimers();

  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const ts = buildRoundTimestamps(nowSec);

  let maxDelayMs = 0;

  for (const entry of wsSequence) {
    const raw = entry as Record<string, unknown>;
    const _t = (raw["_t"] as number) ?? 0;
    const delayMs = _t / SPEED_FACTOR;
    maxDelayMs = Math.max(maxDelayMs, delayMs);

    const timer = setTimeout(() => {
      const { _t: _tIgnored, _note: _noteIgnored, ...msg } = raw;

      if (msg["type"] === "round" && msg["data"]) {
        const baseData = msg["data"] as Record<string, unknown>;
        // Broadcast the same lifecycle event for all four assets.
        for (const asset of ALL_ASSETS) {
          emit({
            ...msg,
            data: {
              ...baseData,
              ...ts,
              asset,
              round_id: ROUND_IDS[asset],
              strike: STRIKE_PRICES[asset],
            },
          });
        }
      } else if (msg["type"] === "price") {
        // Skip — price ticks come from the separate ticker below
      } else {
        emit(msg);
      }
    }, delayMs);

    timers.push(timer);
  }

  // Restart loop after last entry + 2s gap
  const loopTimer = setTimeout(startLoop, maxDelayMs + 2000);
  timers.push(loopTimer);
}

function startPriceTicker() {
  const ticker = setInterval(() => {
    for (const [asset, price] of Object.entries(indicativePrices)) {
      // Small random walk (±0.05%)
      indicativePrices[asset] = price * (1 + (Math.random() - 0.5) * 0.001);
      emit({
        type: "price",
        asset,
        // Indicative display price — NOT the settlement price (which comes from Reflector oracle)
        price: indicativePrices[asset]!.toFixed(asset === "BTC" || asset === "ETH" ? 2 : 4),
        ts: Date.now(),
      });
    }
  }, 500);

  return () => clearInterval(ticker);
}

// Auto-start on first import (browser only)
let started = false;
let stopTicker: (() => void) | null = null;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  startLoop();
  stopTicker = startPriceTicker();
}

export const mockClock = {
  start,

  subscribe(listener: Listener): () => void {
    start(); // idempotent
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  stop() {
    clearTimers();
    stopTicker?.();
    started = false;
  },
};
