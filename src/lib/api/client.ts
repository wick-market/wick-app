/**
 * API client. In mock mode, MSW intercepts these fetch calls transparently —
 * no changes needed here. The same code runs in both mock and real mode.
 */

import type { Round } from "@/lib/domain/round";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface UserPosition extends Round {
  id: number;
  tx_hash: string;
  event_index: number;
  user_addr: string;
  side: "Up" | "Down";
  amount: string;
  placed_at: string;
}

export interface ClaimablePosition {
  round_id: string;
  side: "Up" | "Down";
  amount: string;
  outcome: "Up" | "Down" | "Void";
  pool_up: string;
  pool_down: string;
  settle_price: string | null;
  strike: string;
  asset: string;
  settle_ts: number;
  claimable: string;
}

export interface LeaderboardEntry {
  user_addr: string;
  rounds_entered: string;
  total_won: string;
  total_staked: string;
  net_pnl: string;
}

export interface Stats {
  total_rounds: string;
  settled_rounds: string;
  total_volume: string;
  active_assets: string;
}

// ── Endpoints ──────────────────────────────────────────────────────────────

export const api = {
  getCurrentRounds: (asset: string) =>
    get<Round[]>(`/api/rounds/current?asset=${asset}`),

  getRoundHistory: (asset: string, limit = 50) =>
    get<Round[]>(`/api/rounds/history?asset=${asset}&limit=${limit}`),

  getRoundById: (id: string) => get<Round>(`/api/rounds/${id}`),

  getUserPositions: (address: string) =>
    get<UserPosition[]>(`/api/users/${address}/positions`),

  getUserClaimable: (address: string) =>
    get<ClaimablePosition[]>(`/api/users/${address}/claimable`),

  getLeaderboard: (window: "24h" | "7d" | "30d" = "7d") =>
    get<LeaderboardEntry[]>(`/api/leaderboard?window=${window}`),

  getStats: () => get<Stats>("/api/stats"),
};
