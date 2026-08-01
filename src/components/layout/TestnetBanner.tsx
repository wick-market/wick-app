/**
 * Cannot be dismissed. Testnet-only notice with friendbot link.
 * A user who loses funds on testnet because they thought it was real
 * is our failure, not theirs.
 */
export function TestnetBanner() {
  return (
    <div className="w-full bg-amber-500 text-black text-sm font-semibold text-center px-4 py-2">
      ⚠️ TESTNET ONLY — all XLM is worthless test tokens.{" "}
      <a
        href="https://friendbot.stellar.org"
        target="_blank"
        rel="noreferrer"
        className="underline hover:no-underline"
      >
        Get free testnet XLM →
      </a>
    </div>
  );
}
