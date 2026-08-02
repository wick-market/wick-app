/**
 * wick-predict contract interface.
 * Reads round state via free RPC simulation (no signing, no cost).
 * Mutating calls (bet, claim, settle) open the wallet.
 */
import { Client, networks } from "./predict-bindings/src/index";
import type {
  Round,
  Position,
  Config,
  Side,
} from "./predict-bindings/src/index";
import { Keypair, Networks, rpc } from "@stellar/stellar-sdk";

export type { Round, Position, Config, Side };

// Demo contract: test oracle, 60s rounds, 45s betting window
export const CONTRACT_ID = "CBJDHRRZ7G62S5ZGDEM53CIHRS3OMKCGOHM27I5XYBD2ANNVNIAJHTX2";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const EXPLORER_TX = "https://stellar.expert/explorer/testnet/tx";

// Dummy public key for simulation-only reads (no auth required for views).
const READ_PK = "GBGCQGIFNIPDRZ6GN5CFSW5T5KCTGLXDY5HD7ISY6EBDVU7Q2YFBDXUJ";

function buildClient(publicKey = READ_PK) {
  return new Client({ ...networks.testnet, rpcUrl: RPC_URL, publicKey });
}

// ── Views (free, no wallet) ───────────────────────────────────────────────────

export async function getCurrentRoundId(): Promise<bigint> {
  const client = buildClient();
  const tx = await client.current_round_id();
  return tx.result as bigint;
}

export async function getRound(roundId: bigint): Promise<Round | null> {
  try {
    const client = buildClient();
    const tx = await client.get_round({ round_id: roundId });
    return tx.result as Round;
  } catch {
    return null;
  }
}

export async function getPosition(
  roundId: bigint,
  userAddress: string
): Promise<Position | null> {
  try {
    const client = buildClient(userAddress);
    const tx = await client.get_position({ round_id: roundId, user: userAddress });
    return (tx.result as Position | null) ?? null;
  } catch {
    return null;
  }
}

export async function getConfig(): Promise<Config | null> {
  try {
    const client = buildClient();
    const tx = await client.get_config();
    return tx.result as Config;
  } catch {
    return null;
  }
}

// ── Mutations (require wallet) ────────────────────────────────────────────────

export interface TxResult {
  hash: string;
  explorerUrl: string;
}

async function signTx(xdr: string): Promise<{ signedTxXdr: string; signerAddress?: string }> {
  const { StellarWalletsKit, WalletNetwork, allowAllModules } = await import(
    "@creit.tech/stellar-wallets-kit"
  );
  const kit = new StellarWalletsKit({
    network: WalletNetwork.TESTNET,
    selectedWalletId: "freighter",
    modules: allowAllModules(),
  });
  const { address } = await kit.getAddress();
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });
  return { signedTxXdr, signerAddress: address };
}

async function submitTx(
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: { signAndSend: (opts: any) => Promise<any> }
): Promise<TxResult> {
  const sent = await tx.signAndSend({ signTransaction: signTx });
  const hash = (sent.sendTransactionResponse?.hash as string | undefined) ?? "";
  return { hash, explorerUrl: `${EXPLORER_TX}/${hash}` };
}

export async function betAbove(
  userAddress: string,
  roundId: bigint,
  amountStroops: bigint
): Promise<TxResult> {
  const client = buildClient(userAddress);
  const tx = await client.bet_above({ user: userAddress, round_id: roundId, amount: amountStroops });
  return submitTx("bet_above", tx);
}

export async function betBelow(
  userAddress: string,
  roundId: bigint,
  amountStroops: bigint
): Promise<TxResult> {
  const client = buildClient(userAddress);
  const tx = await client.bet_below({ user: userAddress, round_id: roundId, amount: amountStroops });
  return submitTx("bet_below", tx);
}

export async function claim(userAddress: string, roundId: bigint): Promise<TxResult> {
  const client = buildClient(userAddress);
  const tx = await client.claim({ user: userAddress, round_id: roundId });
  return submitTx("claim", tx);
}

export async function settle(roundId: bigint, callerAddress: string): Promise<TxResult> {
  const client = buildClient(callerAddress);
  const tx = await client.settle({ round_id: roundId });
  return submitTx("settle", tx);
}

// ── Error parsing ─────────────────────────────────────────────────────────────

const ERRORS: Record<number, string> = {
  3: "Round not found",
  4: "Betting is closed",
  5: "Round not yet settled",
  6: "Round already settled",
  7: "Too early to settle",
  8: "Minimum bet is 10 XLM",
  9: "You already have a position this round",
  10: "Nothing to claim",
  14: "A round already exists for this oracle tick",
};

export function parseError(err: unknown): string {
  const msg = String(err);
  const m = msg.match(/#(\d+)/);
  if (m?.[1]) return ERRORS[parseInt(m[1])] ?? `Contract error #${m[1]}`;
  if (msg.includes("insufficient") || msg.includes("balance"))
    return "Insufficient XLM — top up at friendbot.stellar.org";
  if (msg.includes("declined") || msg.includes("UserDeclined"))
    return "Cancelled in wallet";
  return "Transaction failed";
}

// ── Domain helpers ────────────────────────────────────────────────────────────

export const ORACLE_DECIMALS = 14n;
export const STROOP_DECIMALS = 7n;
export const STROOP_DIVISOR = 10n ** STROOP_DECIMALS; // 10_000_000

/** raw i128 (14 decimals) → display string like "$0.1708" */
export function formatOraclePrice(raw: bigint): string {
  const d = 10n ** ORACLE_DECIMALS;
  const whole = raw / d;
  const frac = raw % d;
  const fracStr = frac.toString().padStart(14, "0").slice(0, 4);
  return `$${whole.toLocaleString("en-US")}.${fracStr}`;
}

/** stroops → display XLM like "10.00 XLM" */
export function formatXlm(stroops: bigint, dp = 2): string {
  const whole = stroops / STROOP_DIVISOR;
  const frac = stroops % STROOP_DIVISOR;
  const fracStr = frac.toString().padStart(7, "0").slice(0, dp);
  return `${whole.toLocaleString("en-US")}.${fracStr} XLM`;
}

/** XLM string → stroops bigint */
export function xlmToStroops(xlm: string): bigint {
  const [whole = "0", frac = ""] = xlm.split(".");
  return BigInt(whole) * STROOP_DIVISOR + BigInt(frac.slice(0, 7).padEnd(7, "0"));
}

/** Ninetails boosted shares: amount × seconds remaining until lock.
 * Bet at open → max boost. Bet just before lock → almost zero boost.
 */
export function computeBoosted(amount: bigint, nowSec: number, lockTsSec: number): bigint {
  const remaining = BigInt(Math.max(0, lockTsSec - nowSec));
  return amount * remaining;
}

/** Winner payout (9lives Ninetails):
 *   base         = staked amount (1:1 guarantee — always get your stake back)
 *   winner_bonus = 70% of distributed × user_side_boosted / total_side_boosted
 *   early_bonus  = 30% of distributed × user_boosted / global_boosted
 */
export function computeWinnerPayout(
  staked: bigint,
  distributed: bigint,
  userBoosted: bigint,
  sideBoosted: bigint,
  globalBoosted: bigint
): bigint {
  if (distributed === 0n) return staked;
  const winnerShare = sideBoosted > 0n
    ? (distributed * 7_000n / 10_000n * userBoosted) / sideBoosted
    : 0n;
  const refundShare = globalBoosted > 0n
    ? (distributed * 3_000n / 10_000n * userBoosted) / globalBoosted
    : 0n;
  return staked + winnerShare + refundShare;
}

/** Loser refund (Ninetails):
 *   30% of distributed × user_boosted / global_boosted
 *   Even losers get something back proportional to how early they bet.
 */
export function computeLoserPayout(
  distributed: bigint,
  userBoosted: bigint,
  globalBoosted: bigint
): bigint {
  if (globalBoosted === 0n || distributed === 0n) return 0n;
  return (distributed * 3_000n / 10_000n * userBoosted) / globalBoosted;
}

/** Wallet balance from Horizon */
export async function getXlmBalance(address: string): Promise<string | null> {
  try {
    const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      balances?: Array<{ asset_type: string; balance: string }>;
    };
    return data.balances?.find((b) => b.asset_type === "native")?.balance ?? null;
  } catch {
    return null;
  }
}
