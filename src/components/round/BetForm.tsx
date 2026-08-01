"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { bet, parseContractError, type TxResult } from "@/lib/stellar/wallet";
import { xlmToStroops } from "@/lib/domain/format";
import { canBet } from "@/lib/domain/round";
import type { Round } from "@/lib/domain/round";

const MIN_BET_XLM = "10";

type TxState = "idle" | "simulating" | "signing" | "submitting" | "confirmed" | "error";

interface Props {
  round: Round;
  nowSec: number;
  onConfirmed?: () => void | Promise<void>;
}

export function BetForm({ round, nowSec, onConfirmed }: Props) {
  const { connected, connect, xlmBalance, refreshBalance } = useWallet();
  const [side, setSide] = useState<"Up" | "Down" | null>(null);
  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<TxResult | null>(null);

  const open = canBet(round, nowSec);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!side || !amount || !open) return;

    setErrorMsg(null);
    setTxResult(null);

    try {
      setTxState("simulating");
      const stroops = xlmToStroops(amount);
      setTxState("signing"); // wallet dialog opens here
      const result = await bet(round.round_id, side, stroops);
      setTxResult(result);
      setTxState("confirmed");
      setAmount("");
      void refreshBalance();
      void onConfirmed?.(); // re-read round state so pool updates immediately
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

  if (txState === "confirmed" && txResult) {
    return (
      <div className="rounded-lg border border-up/30 bg-up-dim/20 px-4 py-5 space-y-2">
        <p className="font-semibold text-up text-center">Position placed ✓</p>
        <p className="text-xs text-center text-wick-muted">
          {side === "Up" ? "▲ Above" : "▼ Below"} · {amount} XLM
        </p>
        <a
          href={txResult.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs text-phase-open underline hover:no-underline"
        >
          View on Stellar Expert →
        </a>
        <button
          onClick={() => { setTxState("idle"); setSide(null); }}
          className="block w-full text-center text-xs text-wick-muted underline hover:text-white mt-1"
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

      {/* Amount + balance hint */}
      <div className="space-y-1">
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
        {xlmBalance && (
          <p className="text-xs text-wick-muted text-right">
            Balance:{" "}
            <button
              type="button"
              className="text-white hover:underline"
              onClick={() => setAmount((parseFloat(xlmBalance) * 0.9).toFixed(2))}
              title="Use 90% of balance"
            >
              {parseFloat(xlmBalance).toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM
            </button>
          </p>
        )}
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
          {busy && (
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
          )}
          {stateLabel[txState]}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void connect()}
          className="w-full rounded-lg border border-phase-open py-2.5 text-sm font-semibold text-phase-open transition-colors hover:bg-phase-open hover:text-white"
        >
          Connect wallet to bet
        </button>
      )}
    </form>
  );
}
