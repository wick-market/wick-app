/**
 * Round domain logic: phase state machine and parimutuel payout math.
 * Everything here is pure — no React, no network, no side effects.
 *
 * The phase state machine is the foundation everything else is built on.
 * It MUST work correctly; it is not a TODO stub.
 */

// ── Types (mirrors openapi.yaml Round schema) ──────────────────────────────

export interface Round {
  round_id: string;
  asset: string;
  strike: string;
  strike_ts: number;
  lock_ts: number;
  settle_ts: number;
  pool_up: string;
  pool_down: string;
  status: "Open" | "Locked" | "Settled";
  outcome: "Up" | "Down" | "Void" | null;
  settle_price: string | null;
  created_at: string;
  settled_at: string | null;
}

// ── Phase ──────────────────────────────────────────────────────────────────

export type Phase =
  | "Open"      // bets accepted; now < lock_ts
  | "Locked"    // 2-min dead window; lock_ts ≤ now < settle_ts
  | "Settling"  // settle_ts passed but keeper hasn't confirmed on-chain yet
  | "Settled"   // status=Settled, outcome=Up or Down
  | "Void";     // status=Settled, outcome=Void

/**
 * Derive the current phase from a round and the current unix timestamp (seconds).
 * The status field in the DB lags behind real-time by up to one keeper interval;
 * the lock_ts/settle_ts fields are the authoritative source of truth for timing.
 */
export function getPhase(round: Round, nowSec: number): Phase {
  if (round.status === "Settled") {
    return round.outcome === "Void" ? "Void" : "Settled";
  }
  if (nowSec >= round.settle_ts) return "Settling";
  if (nowSec >= round.lock_ts) return "Locked";
  return "Open";
}

export function isPhaseActive(phase: Phase): boolean {
  return phase === "Open" || phase === "Locked" || phase === "Settling";
}

export function canBet(round: Round, nowSec: number): boolean {
  return getPhase(round, nowSec) === "Open";
}

// ── Payout math ────────────────────────────────────────────────────────────

export interface Multiples {
  up: number | null;   // null when pool side is 0 (no one on that side)
  down: number | null;
}

/**
 * How far through the betting window we are, 0–1.
 * 0 = round just opened (best time to bet).
 * 1 = betting about to close (worst time to bet).
 * Returns null when the window has closed.
 */
export function bettingWindowProgress(round: Round, nowSec: number): number | null {
  const window = round.lock_ts - round.strike_ts;
  if (window <= 0) return null;
  const elapsed = nowSec - round.strike_ts;
  if (elapsed < 0) return 0;
  if (elapsed >= window) return null; // locked
  return Math.min(1, elapsed / window);
}

/**
 * Compute the provisional payout multiple for each side.
 * All arithmetic in BigInt — no floats.
 *
 * Formula:
 *   total       = pool_up + pool_down
 *   distributed = total × (10_000 − fee_bps) / 10_000
 *   multiple_X  = distributed / pool_X
 *
 * These are PROVISIONAL until lock_ts — they move as the pool shifts.
 * Never display them as fixed odds.
 */
export function computeMultiples(round: Round, feeBps = 200): Multiples {
  const poolUp = BigInt(round.pool_up);
  const poolDown = BigInt(round.pool_down);
  const total = poolUp + poolDown;

  if (total === 0n) return { up: null, down: null };

  const distributed = (total * BigInt(10_000 - feeBps)) / 10_000n;

  // Scale by 100 before dividing for 2dp precision, then divide back.
  const up = poolUp > 0n ? Number((distributed * 100n) / poolUp) / 100 : null;
  const down = poolDown > 0n ? Number((distributed * 100n) / poolDown) / 100 : null;

  return { up, down };
}

/**
 * Compute a specific bettor's payout given final pool state.
 * Returns stroops as a bigint. Returns 0n for losers and void is handled separately.
 */
export function computePayout(
  betAmount: string,
  betSide: "Up" | "Down",
  round: Round,
  feeBps = 200
): bigint {
  if (round.outcome === "Void") return BigInt(betAmount); // gross refund
  if (round.outcome === null) return 0n;
  if (round.outcome !== betSide) return 0n;

  const amount = BigInt(betAmount);
  const total = BigInt(round.pool_up) + BigInt(round.pool_down);
  const distributed = (total * BigInt(10_000 - feeBps)) / 10_000n;
  const winningPool = round.outcome === "Up" ? BigInt(round.pool_up) : BigInt(round.pool_down);

  if (winningPool === 0n) return amount; // void-like edge case
  return (amount * distributed) / winningPool;
}

// ── Pool display ───────────────────────────────────────────────────────────

/** Pool split as a percentage of total (0–100). Returns [upPct, downPct]. */
export function poolSplit(round: Round): [number, number] {
  const up = BigInt(round.pool_up);
  const down = BigInt(round.pool_down);
  const total = up + down;
  if (total === 0n) return [50, 50];
  const upPct = Number((up * 100n) / total);
  return [upPct, 100 - upPct];
}

// ── Countdown helpers ──────────────────────────────────────────────────────

export function secsUntilLock(round: Round, nowSec: number): number {
  return Math.max(0, round.lock_ts - nowSec);
}

export function secsUntilSettle(round: Round, nowSec: number): number {
  return Math.max(0, round.settle_ts - nowSec);
}

// ── Assets ─────────────────────────────────────────────────────────────────

export const ASSETS = ["BTC", "ETH", "SOL", "XLM"] as const;
export type Asset = (typeof ASSETS)[number];
