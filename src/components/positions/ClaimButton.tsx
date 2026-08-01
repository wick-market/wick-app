"use client";

import { useState } from "react";
import { claim, NotImplementedError } from "@/lib/stellar/wallet";
import { formatXlm } from "@/lib/domain/format";

interface Props {
  roundId: string;
  payout: string; // stroops
}

/**
 * Triggers a claim transaction. The actual signing/submission is a stub.
 *
 * TODO: Issue #2 — implement claim() in src/lib/stellar/wallet.ts
 */
export function ClaimButton({ roundId, payout }: Props) {
  const [status, setStatus] = useState<"idle" | "pending" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClaim() {
    setStatus("pending");
    setErrorMsg(null);
    try {
      await claim(roundId);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      if (err instanceof NotImplementedError) {
        setErrorMsg("Claim coming soon — see CONTRIBUTING.md");
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      }
    }
  }

  if (status === "done") {
    return (
      <span className="text-sm font-semibold text-up">Claimed ✓</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => void handleClaim()}
        disabled={status === "pending"}
        className="rounded-lg bg-up px-4 py-1.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === "pending" ? "Claiming…" : `Claim ${formatXlm(payout)}`}
      </button>
      {errorMsg && <p className="text-xs text-wick-muted">{errorMsg}</p>}
    </div>
  );
}
