"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { bet, parseContractError } from "@/lib/stellar/wallet";
import { xlmToStroops } from "@/lib/domain/format";
import { canBet } from "@/lib/domain/round";
import type { Round } from "@/lib/domain/round";

const MIN_BET_XLM = "10";

type TxState = "idle" | "simulating" | "signing" | "submitting" | "confirmed" | "error";

interface Props {
  round: Round;
  nowSec: number;
}

export function BetForm({ round, nowSec }: Props) {
  const { connected, connect } = useWallet();
  const [side, setSide] = useState<"Up" | "Down" | null>(null);
  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const open = canBet(round, nowSec);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!side || !amount || !open) return;

    setErrorMsg(null);

    try {
      setTxState("simulating");
      const stroops = xlmToStroops(amount);
      // signAndSend handles: simulate → sign → submit → confirm
      setTxState("signing");
      await bet(round.round_id, side, stroops);
      setTxState("confirmed");
      setAmount("");
    } catch (err) {
      setTxState("error");
      setErrorMsg(parseContractError(err));
    }
  }

  if (!open) {
    return (
      <div className="rounded-lg border border-wick-border bg-wick-bg px-4 py-3 text-center text-sm text-wick-muted">
        Betting is closed for this round.
      </div>
    );
  }

  if (txState === "confirmed") {
    return (
      <div className="rounded-lg border border-up/30 bg-up-dim/20 px-4 py-4 text-center">
        <p className="text-up font-semibold">Position placed ✓</p>
        <p className="mt-1 text-xs text-wick-muted">
          {side === "Up" ? "▲ Above" : "▼ Below"} · {amount} XLM
        </p>
        <button
          onClick={() => { setTxState("idle"); setSide(null); }}
          className="mt-3 text-xs text-wick-muted underline hover:text-white"
        >
          Place another
        </button>
      </div>
    );
  }

  const stateLabel: Record<TxState, string> = {
    idle: side ? `Bet ${side === "Up" ? "Above" : "Below"}` : "Select a side",
    simulating: "Simulating…",
    signing: "Check your wallet…",
    submitting: "Submitting…",
    confirmed: "Confirmed",
    error: "Try again",
  };

  const busy = txState === "simulating" || txState === "signing" || txState === "submitting";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {/* Side selection */}
      <div className="grid grid-cols-2 gap-3">
        {(["Up", "Down"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setSide(s); setTxState("idle"); setErrorMsg(null); }}
            disabled={busy}
            className={`rounded-lg border py-3 text-sm font-bold transition-all ${
              side === s
                ? s === "Up"
                  ? "border-up bg-up-dim text-up"
                  : "border-down bg-down-dim text-down"
                : "border-wick-border text-wick-muted hover:border-white/30 hover:text-white"
            } disabled:opacity-40`}
          >
            {s === "Up" ? "▲ ABOVE" : "▼ BELOW"}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="flex items-center gap-2 rounded-lg border border-wick-border bg-wick-bg px-3 py-2 focus-within:border-white/30">
        <input
          type="number"
          min={MIN_BET_XLM}
          step="any"
          placeholder={`Min ${MIN_BET_XLM} XLM`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
          className="flex-1 bg-transparent text-white placeholder:text-wick-muted focus:outline-none disabled:opacity-40"
        />
        <span className="text-sm text-wick-muted">XLM</span>
      </div>

      {/* Error */}
      {errorMsg && <p className="text-xs text-down">{errorMsg}</p>}

      {/* Submit or connect */}
      {connected ? (
        <button
          type="submit"
          disabled={!side || !amount || busy}
          className="w-full rounded-lg bg-phase-open py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {stateLabel[txState]}
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
