"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { bet, NotImplementedError } from "@/lib/stellar/wallet";
import { xlmToStroops } from "@/lib/domain/format";
import { canBet } from "@/lib/domain/round";
import type { Round } from "@/lib/domain/round";

const MIN_BET_XLM = "10";

interface Props {
  round: Round;
  nowSec: number;
}

/**
 * Bet entry form. Side selection and amount input are fully functional.
 * Transaction submission is a typed stub pending Issue #1.
 */
export function BetForm({ round, nowSec }: Props) {
  const { connected, connect } = useWallet();
  const [side, setSide] = useState<"Up" | "Down" | null>(null);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const open = canBet(round, nowSec);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!side || !amount || !open) return;
    setStatus("pending");
    setErrorMsg(null);

    try {
      const stroops = xlmToStroops(amount);
      await bet(round.round_id, side, stroops);
      setStatus("idle");
      setAmount("");
    } catch (err) {
      setStatus("error");
      if (err instanceof NotImplementedError) {
        setErrorMsg("Betting is coming soon. See CONTRIBUTING.md to claim this issue.");
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      }
    }
  }

  if (!open) {
    return (
      <div className="rounded-lg border border-wick-border bg-wick-bg px-4 py-3 text-center text-sm text-wick-muted">
        Betting is closed for this round.
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {/* Side selection */}
      <div className="grid grid-cols-2 gap-3">
        {(["Up", "Down"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`rounded-lg border py-3 text-sm font-bold transition-all ${
              side === s
                ? s === "Up"
                  ? "border-up bg-up-dim text-up"
                  : "border-down bg-down-dim text-down"
                : "border-wick-border text-wick-muted hover:border-white/30 hover:text-white"
            }`}
          >
            {s === "Up" ? "▲ ABOVE" : "▼ BELOW"}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="flex items-center gap-2 rounded-lg border border-wick-border bg-wick-bg px-3 py-2">
        <input
          type="number"
          min={MIN_BET_XLM}
          step="any"
          placeholder={`Min ${MIN_BET_XLM} XLM`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-transparent text-white placeholder:text-wick-muted focus:outline-none"
        />
        <span className="text-sm text-wick-muted">XLM</span>
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="text-xs text-down">{errorMsg}</p>
      )}

      {/* Submit */}
      {connected ? (
        <button
          type="submit"
          disabled={!side || !amount || status === "pending"}
          className="w-full rounded-lg bg-phase-open py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {status === "pending" ? "Confirming…" : `Bet ${side ? (side === "Up" ? "Above" : "Below") : ""}`}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void connect()}
          className="w-full rounded-lg border border-wick-border py-2.5 text-sm font-semibold text-wick-muted transition-colors hover:text-white"
        >
          Connect wallet to bet
        </button>
      )}
    </form>
  );
}
