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
  PriceData,
  OracleAsset,
} from "./predict-bindings/src/index";
import { Networks, Contract, TransactionBuilder, BASE_FEE, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";

export type { Round, Position, Config, Side, PriceData, OracleAsset };

/**
 * Test oracle — admin-controlled price feed used by the deployed contracts.
 * Same SEP-40 interface as Reflector, so reading it here shows exactly the
 * price a round will settle against. See wick-protocol/contracts/test-oracle.
 */
export const TEST_ORACLE = "CBGWLGKZMEMW2IHDSXRL5QUTYRXSBGNCMQHFHRVZH6UETCNXV4NFDHAG";

export interface Market {
  symbol: string;
  name: string;
  contractId: string;
  decimals: number;
  icon: string;
  coingeckoId: string;
  binanceSymbol: string;
}

export const MARKETS: Record<"BTC" | "ETH" | "SOL" | "XLM", Market> = {
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    contractId: "CAHYZ6K54567DHRSHEOB6BEFDD6GOXGIMX736RJWSSSA6DHLOHKFDOX2",
    decimals: 2,
    icon: "₿",
    coingeckoId: "bitcoin",
    binanceSymbol: "BTCUSDT",
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    contractId: "CC4MONXL6CIZ5F4VSNE2CFQZ6HXTSDJHEEUNGVUSFPUEZUJ7KAOWXSOM",
    decimals: 2,
    icon: "Ξ",
    coingeckoId: "ethereum",
    binanceSymbol: "ETHUSDT",
  },
  SOL: {
    symbol: "SOL",
    name: "Solana",
    contractId: "CDDEM7TRNHQMIYTOYZUIFLOAF32K5MBP4WSDMKUGGGPGDCGU73CEYCJN",
    decimals: 2,
    icon: "◎",
    coingeckoId: "solana",
    binanceSymbol: "SOLUSDT",
  },
  XLM: {
    symbol: "XLM",
    name: "Stellar",
    contractId: "CBQMEF4YZVTEVV3KHSUVOBWWHTTJ2D6YAOGE5TGZT7WTMHJ7ORYMT5HU",
    decimals: 4,
    icon: "🚀",
    coingeckoId: "stellar",
    binanceSymbol: "XLMUSDT",
  },
};

export const DEFAULT_MARKET = MARKETS.BTC;
export const CONTRACT_ID = DEFAULT_MARKET.contractId;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const EXPLORER_TX = "https://stellar.expert/explorer/testnet/tx";

// Dummy public key for simulation-only reads (no auth required for views).
const READ_PK = "GBGCQGIFNIPDRZ6GN5CFSW5T5KCTGLXDY5HD7ISY6EBDVU7Q2YFBDXUJ";

function buildClient(contractId: string = CONTRACT_ID, publicKey = READ_PK) {
  return new Client({ ...networks.testnet, rpcUrl: RPC_URL, publicKey, contractId });
}

// ── Views (free, no wallet) ───────────────────────────────────────────────────

export async function getCurrentRoundId(contractId: string = CONTRACT_ID): Promise<bigint> {
  const client = buildClient(contractId);
  const tx = await client.current_round_id();
  return tx.result as bigint;
}

export async function getRound(roundId: bigint, contractId: string = CONTRACT_ID): Promise<Round | null> {
  try {
    const client = buildClient(contractId);
    const tx = await client.get_round({ round_id: roundId });
    return tx.result as Round;
  } catch {
    return null;
  }
}

export async function getPosition(
  roundId: bigint,
  userAddress: string,
  contractId: string = CONTRACT_ID
): Promise<Position | null> {
  try {
    const client = buildClient(contractId, userAddress);
    const tx = await client.get_position({ round_id: roundId, user: userAddress });
    return (tx.result as Position | null) ?? null;
  } catch {
    return null;
  }
}

export async function getConfig(contractId: string = CONTRACT_ID): Promise<Config | null> {
  try {
    const client = buildClient(contractId);
    const tx = await client.get_config();
    return tx.result as Config;
  } catch {
    return null;
  }
}

// ── Oracle price (test oracle, on-chain) ───────────────────────────────────────

/**
 * Read the live price the contract actually settles against. Uses a free RPC
 * simulation (no signing, no wallet), so it replaces CoinGecko/Binance calls
 * that 429'd or were geo-blocked — and it can never disagree with the round.
 */
export async function getOraclePrice(
  symbol: string,
  oracleId: string = TEST_ORACLE
): Promise<{ price: string; timestamp: number } | null> {
  try {
    const server = new rpc.Server(RPC_URL, { allowHttp: false });
    const account = await server.getAccount(READ_PK);
    const oracle = new Contract(oracleId);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        oracle.call("lastprice", xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Other"), xdr.ScVal.scvSymbol(symbol)]))
      )
      .setTimeout(30)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) return null;
    const retval = (sim as rpc.Api.SimulateTransactionSuccessResponse).result!.retval;
    const data = scValToNative(retval) as PriceData | null;
    if (!data) return null;
    return { price: data.price.toString(), timestamp: Number(data.timestamp) };
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

// eslint-disable-next-line
async function submitTx(method: string, tx: any): Promise<TxResult> {
  const sent = await tx.signAndSend({ signTransaction: signTx });
  const hash = (sent?.sendTransactionResponse?.hash as string | undefined) ?? "";
  return { hash, explorerUrl: `${EXPLORER_TX}/${hash}` };
}

export async function betAbove(
  userAddress: string,
  roundId: bigint,
  amountStroops: bigint,
  contractId: string = CONTRACT_ID
): Promise<TxResult> {
  const client = buildClient(contractId, userAddress);
  const tx = await client.bet_above({ user: userAddress, round_id: roundId, amount: amountStroops });
  return submitTx("bet_above", tx);
}

export async function betBelow(
  userAddress: string,
  roundId: bigint,
  amountStroops: bigint,
  contractId: string = CONTRACT_ID
): Promise<TxResult> {
  const client = buildClient(contractId, userAddress);
  const tx = await client.bet_below({ user: userAddress, round_id: roundId, amount: amountStroops });
  return submitTx("bet_below", tx);
}

export async function claim(
  userAddress: string,
  roundId: bigint,
  contractId: string = CONTRACT_ID
): Promise<TxResult> {
  const client = buildClient(contractId, userAddress);
  const tx = await client.claim({ user: userAddress, round_id: roundId });
  return submitTx("claim", tx);
}

export async function settle(
  roundId: bigint,
  callerAddress: string,
  contractId: string = CONTRACT_ID
): Promise<TxResult> {
  const client = buildClient(contractId, callerAddress);
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
  8: "Minimum bet is 1 XLM",
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

/** raw i128 (14 decimals) → display string like "$65,432.10" or "$0.1708" */
export function formatOraclePrice(raw: bigint, displayDecimals = 2): string {
  const d = 10n ** ORACLE_DECIMALS;
  const whole = raw / d;
  const frac = raw % d;
  const fracStr = frac.toString().padStart(14, "0").slice(0, displayDecimals);
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
