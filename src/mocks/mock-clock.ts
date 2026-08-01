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

// 20× compression: 300s round = 15s real, 180s lock = 9s real
const SPEED_FACTOR = 20;

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
};

function emit(msg: WsMsg) {
  listeners.forEach((fn) => fn(msg));
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers.length = 0;
}

function buildRoundTimestamps(nowSec: number) {
  const lockOffset = Math.ceil(180 / SPEED_FACTOR); // 9s
  const settleOffset = Math.ceil(300 / SPEED_FACTOR); // 15s
  return {
    strike_ts: nowSec,
    lock_ts: nowSec + lockOffset,
    settle_ts: nowSec + settleOffset,
  };
}

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
      // Strip fixture-only fields and rewrite round timestamps
      const { _t: _tIgnored, _note: _noteIgnored, ...msg } = raw;

      if (msg["type"] === "round" && msg["data"]) {
        const data = msg["data"] as Record<string, unknown>;
        emit({
          ...msg,
          data: { ...data, ...ts },
        });
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
