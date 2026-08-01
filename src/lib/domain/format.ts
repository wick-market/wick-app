/**
 * Pure formatting helpers. No floats — all math in BigInt.
 *
 * Oracle prices have 14 decimal places: actual_usd = raw / 10^14
 * XLM amounts are in stroops:           actual_xlm = stroops / 10^7
 */

const ORACLE_DECIMALS = 14n;
const STROOP_DECIMALS = 7n;
const STROOP_DIVISOR = 10n ** STROOP_DECIMALS; // 10_000_000n

const ASSET_DISPLAY_DP: Record<string, number> = {
  BTC: 2,
  ETH: 2,
  SOL: 4,
  XLM: 4,
};

/**
 * Format a raw oracle i128 price to a human-readable USD string.
 * e.g. "6303831631126319160" (BTC) → "$63,038.32"
 */
export function formatOraclePrice(raw: string, asset: string): string {
  const n = BigInt(raw);
  const divisor = 10n ** ORACLE_DECIMALS;
  const whole = n / divisor;
  const frac = n % divisor;
  const dp = ASSET_DISPLAY_DP[asset] ?? 4;
  const fracStr = frac.toString().padStart(14, "0").slice(0, dp);
  return `$${whole.toLocaleString("en-US")}.${fracStr}`;
}

/**
 * Format stroops to a human-readable XLM string.
 * e.g. "1000000000" → "100.00 XLM"
 */
export function formatXlm(stroops: string, dp = 2): string {
  const n = BigInt(stroops);
  const whole = n / STROOP_DIVISOR;
  const frac = n % STROOP_DIVISOR;
  const fracStr = frac.toString().padStart(7, "0").slice(0, dp);
  return `${whole.toLocaleString("en-US")}.${fracStr} XLM`;
}

/**
 * Parse an XLM string (e.g. "100.5") to stroops BigInt.
 */
export function xlmToStroops(xlm: string): bigint {
  const [whole, frac = ""] = xlm.split(".");
  const fracPadded = frac.slice(0, 7).padEnd(7, "0");
  return BigInt(whole ?? "0") * STROOP_DIVISOR + BigInt(fracPadded);
}

/**
 * Format a payout multiple to "2.45×"
 */
export function formatMultiple(x: number): string {
  return `${x.toFixed(2)}×`;
}

/**
 * Format seconds into mm:ss countdown string.
 */
export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
