/**
 * Reads round state directly from the Soroban contract via RPC simulation.
 * No indexer or API server needed — works anywhere the user has internet.
 *
 * Scans round IDs in parallel to find active rounds per asset.
 * With only a handful of rounds on testnet this is fast (<1s).
 */
import { Client, networks } from "./bindings/index";
import { TESTNET } from "./bindings/addresses";
import type { Round as UIRound } from "@/lib/domain/round";

// Read-only simulations don't need auth, but the SDK requires a publicKey.
// Any valid G-address works. Use the deployed admin account.
const READ_PUBLIC_KEY = "GBGCQGIFNIPDRZ6GN5CFSW5T5KCTGLXDY5HD7ISY6EBDVU7Q2YFBDXUJ";

function readClient(publicKey = READ_PUBLIC_KEY) {
  return new Client({
    ...networks.testnet,
    rpcUrl: TESTNET.RPC_URL,
    publicKey,
  });
}

/** Convert contract Round struct → UI Round shape */
function toUIRound(id: bigint, r: {
  asset: string;
  strike: bigint;
  strike_ts: bigint;
  lock_ts: bigint;
  settle_ts: bigint;
  pool_up: bigint;
  pool_down: bigint;
  status: { tag: string };
  outcome: { tag: string };
  settle_price: bigint;
}): UIRound {
  return {
    round_id: id.toString(),
    asset: r.asset,
    strike: r.strike.toString(),
    strike_ts: Number(r.strike_ts),
    lock_ts: Number(r.lock_ts),
    settle_ts: Number(r.settle_ts),
    pool_up: r.pool_up.toString(),
    pool_down: r.pool_down.toString(),
    status: r.status.tag as UIRound["status"],
    outcome:
      r.outcome.tag === "Up" ? "Up"
      : r.outcome.tag === "Down" ? "Down"
      : r.outcome.tag === "Void" ? "Void"
      : null,
    settle_price: r.settle_price > 0n ? r.settle_price.toString() : null,
    created_at: new Date().toISOString(),
    settled_at: null,
  };
}

/** Fetch a single round by ID. Returns null on RoundNotFound. */
async function fetchRound(id: bigint, client: Client): Promise<UIRound | null> {
  try {
    const tx = await client.get_round({ round_id: id });
    return toUIRound(id, tx.result as Parameters<typeof toUIRound>[1]);
  } catch {
    return null;
  }
}

/**
 * Scan rounds 1…maxId in parallel to find the latest Open/Locked round
 * for each asset in the given list.
 */
export async function findActiveRounds(
  assets: string[],
  maxId = 30,
  publicKey?: string
): Promise<Record<string, UIRound>> {
  const client = readClient(publicKey);

  // Fetch all rounds in parallel
  const rounds = await Promise.all(
    Array.from({ length: maxId }, (_, i) =>
      fetchRound(BigInt(i + 1), client)
    )
  );

  // Keep the latest Open or Locked round per asset
  const result: Record<string, UIRound> = {};
  for (const round of rounds) {
    if (!round) continue;
    if (!assets.includes(round.asset)) continue;
    const isActive = round.status === "Open" || round.status === "Locked";
    if (!isActive) continue;
    const existing = result[round.asset];
    if (!existing || Number(round.round_id) > Number(existing.round_id)) {
      result[round.asset] = round;
    }
  }
  return result;
}

/** Fetch a single round's current state for a specific round_id. */
export async function fetchRoundById(roundId: string, publicKey?: string): Promise<UIRound | null> {
  const client = readClient(publicKey);
  return fetchRound(BigInt(roundId), client);
}
