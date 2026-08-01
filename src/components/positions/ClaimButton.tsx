"use client";

import { useState } from "react";
import { claim, parseContractError } from "@/lib/stellar/wallet";
import { formatXlm } from "@/lib/domain/format";

type TxState = "idle" | "signing" | "submitting" | "done" | "error";

interface Props {
  roundId: string;
  payout: string; // stroops
}

export function ClaimButton({ roundId, payout }: Props) {
  const [state, setState] = useState<TxState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClaim() {
    setState("signing");
    setErrorMsg(null);
    try {
      await claim(roundId);
      setState("done");
    } catch (err) {
      setState("error");
      setErrorMsg(parseContractError(err));
    }
  }

  if (state === "done") {
    return <span className="text-sm font-semibold text-up">Claimed ✓</span>;
  }

  const busy = state === "signing" || state === "submitting";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => void handleClaim()}
        disabled={busy}
        className="rounded-lg bg-up px-4 py-1.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Check wallet…" : `Claim ${formatXlm(payout)}`}
      </button>
      {errorMsg && <p className="text-xs text-down text-right max-w-[180px]">{errorMsg}</p>}
    </div>
  );
}
