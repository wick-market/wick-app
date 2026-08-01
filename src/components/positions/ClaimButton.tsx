"use client";

import { useState } from "react";
import { claim, parseContractError, type TxResult } from "@/lib/stellar/wallet";
import { useWallet } from "@/contexts/WalletContext";
import { formatXlm } from "@/lib/domain/format";

type TxState = "idle" | "signing" | "done" | "error";

interface Props {
  roundId: string;
  payout: string; // stroops
}

export function ClaimButton({ roundId, payout }: Props) {
  const { connected, connect, refreshBalance } = useWallet();
  const [state, setState] = useState<TxState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<TxResult | null>(null);

  async function handleClaim() {
    if (!connected) {
      await connect();
      return;
    }
    setState("signing");
    setErrorMsg(null);
    try {
      const result = await claim(roundId);
      setTxResult(result);
      setState("done");
      void refreshBalance();
    } catch (err) {
      setState("error");
      setErrorMsg(parseContractError(err));
    }
  }

  if (state === "done" && txResult) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold text-up">Claimed ✓</span>
        <a
          href={txResult.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-phase-open underline hover:no-underline"
        >
          View tx →
        </a>
      </div>
    );
  }

  const busy = state === "signing";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => void handleClaim()}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg bg-up px-4 py-1.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy && (
          <span className="h-3 w-3 animate-spin rounded-full border border-black border-t-transparent" />
        )}
        {busy
          ? "Check wallet…"
          : connected
            ? `Claim ${formatXlm(payout)}`
            : "Connect & claim"}
      </button>
      {errorMsg && (
        <p className="text-xs text-down text-right max-w-[200px]">{errorMsg}</p>
      )}
    </div>
  );
}
