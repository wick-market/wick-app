"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCurrentRoundId,
  getRound,
  getPosition,
  getConfig,
  getXlmBalance,
  betAbove,
  betBelow,
  claim,
  settle,
  parseError,
  formatOraclePrice,
  formatXlm,
  xlmToStroops,
  computeShares,
  computePayout,
  type Round,
  type Position,
  type Config,
  type TxResult,
} from "@/lib/stellar/predict";
import { openConnectModal, getAddress, disconnect } from "@/lib/stellar/wallet";

// ── Wallet hook ───────────────────────────────────────────────────────────────

function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const refreshBalance = useCallback(async (addr: string) => {
    const b = await getXlmBalance(addr);
    setBalance(b);
  }, []);

  useEffect(() => {
    getAddress().then((a) => {
      if (a) { setAddress(a); void refreshBalance(a); }
    });
  }, [refreshBalance]);

  const connect = useCallback(async () => {
    await openConnectModal((a) => {
      setAddress(a);
      void refreshBalance(a);
    });
  }, [refreshBalance]);

  const doDisconnect = useCallback(async () => {
    await disconnect();
    setAddress(null);
    setBalance(null);
  }, []);

  return { address, balance, connect, disconnect: doDisconnect, refreshBalance };
}

// ── Round hook ────────────────────────────────────────────────────────────────

function useRound() {
  const [roundId, setRoundId] = useState<bigint | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    try {
      const [id, cfg] = await Promise.all([getCurrentRoundId(), getConfig()]);
      setConfig(cfg);
      if (id > 0n) {
        setRoundId(id);
        const r = await getRound(id);
        setRound(r);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    pollRef.current = setInterval(() => void load(), 10_000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  return { roundId, round, config, loading, refresh: load };
}

// ── Phase ─────────────────────────────────────────────────────────────────────

type Phase = "Open" | "Locked" | "Settling" | "Settled" | "Void";

function getPhase(round: Round, nowSec: number): Phase {
  const status = round.status.tag;
  if (status === "Settled") {
    return round.outcome.tag === "Void" ? "Void" : "Settled";
  }
  if (nowSec >= Number(round.settle_ts)) return "Settling";
  if (nowSec >= Number(round.lock_ts)) return "Locked";
  return "Open";
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Components ────────────────────────────────────────────────────────────────

function PhaseTag({ phase }: { phase: Phase }) {
  const styles: Record<Phase, string> = {
    Open:     "bg-green-500/10 text-green-400 border-green-500/30",
    Locked:   "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Settling: "bg-purple-500/10 text-purple-400 border-purple-500/30 animate-pulse",
    Settled:  "bg-zinc-700/50 text-zinc-300 border-zinc-600",
    Void:     "bg-zinc-700/50 text-zinc-400 border-zinc-600",
  };
  const labels: Record<Phase, string> = {
    Open: "● OPEN", Locked: "● LOCKED", Settling: "● SETTLING",
    Settled: "SETTLED", Void: "VOID",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide ${styles[phase]}`}>
      {labels[phase]}
    </span>
  );
}

function BetButton({
  label,
  color,
  onClick,
  active,
  disabled,
}: {
  label: string;
  color: "green" | "red";
  onClick: () => void;
  active: boolean;
  disabled: boolean;
}) {
  const base =
    color === "green"
      ? "border-green-500 text-green-400 hover:bg-green-500/10"
      : "border-red-500 text-red-400 hover:bg-red-500/10";
  const activeStyle =
    color === "green" ? "bg-green-500/20 border-green-400" : "bg-red-500/20 border-red-400";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg border py-3 text-sm font-bold transition-all disabled:opacity-30 ${
        active ? activeStyle : base
      }`}
    >
      {label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function XlmMarket() {
  const wallet = useWallet();
  const { round, roundId, config, loading, refresh } = useRound();
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [position, setPosition] = useState<Position | null>(null);
  const [side, setSide] = useState<"Above" | "Below" | null>(null);
  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Live second ticker
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Load position when wallet + round known
  useEffect(() => {
    if (!wallet.address || !roundId) return;
    void getPosition(roundId, wallet.address).then(setPosition);
  }, [wallet.address, roundId]);

  const phase = round ? getPhase(round, nowSec) : null;
  const canBet = phase === "Open" && !position && wallet.address;
  const feeBps = BigInt(config?.fee_bps ?? 200);

  // Multiples preview (time-weighted)
  const previewShares =
    round && amount && canBet
      ? computeShares(xlmToStroops(amount), nowSec, Number(round.strike_ts), Number(round.lock_ts))
      : null;

  async function handleBet(e: React.FormEvent) {
    e.preventDefault();
    if (!side || !amount || !roundId || !wallet.address) return;
    setTxState("signing");
    setErrMsg(null);
    try {
      const stroops = xlmToStroops(amount);
      const res =
        side === "Above"
          ? await betAbove(wallet.address, roundId, stroops)
          : await betBelow(wallet.address, roundId, stroops);
      setTxResult(res);
      setTxState("done");
      void refresh();
      if (wallet.address) {
        void wallet.refreshBalance(wallet.address);
        void getPosition(roundId, wallet.address).then(setPosition);
      }
    } catch (err) {
      setTxState("error");
      setErrMsg(parseError(err));
    }
  }

  async function handleClaim() {
    if (!roundId || !wallet.address) return;
    setTxState("signing");
    setErrMsg(null);
    try {
      const res = await claim(wallet.address, roundId);
      setTxResult(res);
      setTxState("done");
      void wallet.refreshBalance(wallet.address);
    } catch (err) {
      setTxState("error");
      setErrMsg(parseError(err));
    }
  }

  async function handleSettle() {
    if (!roundId || !wallet.address) return;
    setTxState("signing");
    setErrMsg(null);
    try {
      const res = await settle(roundId, wallet.address);
      setTxResult(res);
      setTxState("done");
      void refresh();
    } catch (err) {
      setTxState("error");
      setErrMsg(parseError(err));
    }
  }

  const busy = txState === "signing";
  const countdownTarget = round
    ? phase === "Open" ? Number(round.lock_ts) : Number(round.settle_ts)
    : 0;
  const secsLeft = Math.max(0, countdownTarget - nowSec);

  return (
    <div className="mx-auto max-w-lg space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">XLM / USD</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Predict whether XLM closes above or below the strike price
          </p>
        </div>
        {wallet.address ? (
          <div className="flex items-center gap-2 text-right">
            <div>
              <p className="text-sm font-medium text-white">
                {wallet.balance
                  ? `${parseFloat(wallet.balance).toFixed(2)} XLM`
                  : "—"}
              </p>
              <button
                onClick={() => void wallet.disconnect()}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)} · disconnect
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => void wallet.connect()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* Testnet banner */}
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-400 text-center">
        ⚠ Testnet only — XLM has no real value ·{" "}
        <a href="https://friendbot.stellar.org" target="_blank" rel="noreferrer" className="underline">
          Get free XLM
        </a>
      </div>

      {/* Round card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
            <span className="text-sm text-zinc-500">Reading from chain…</span>
          </div>
        ) : !round ? (
          <div className="py-8 text-center space-y-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500 mx-auto" />
            <p className="text-zinc-400 font-medium">Waiting for next round</p>
            <p className="text-zinc-600 text-xs">
              The Reflector oracle updates every 5 minutes.
              A new round opens automatically after the next price tick.
            </p>
            {/* Show when the next oracle tick is expected */}
            {(() => {
              const nextTick = Math.ceil(nowSec / 300) * 300;
              const secsToTick = Math.max(0, nextTick - nowSec);
              return secsToTick > 0 ? (
                <p className="text-zinc-500 text-sm font-mono">
                  Next tick in {formatCountdown(secsToTick)}
                </p>
              ) : null;
            })()}
          </div>
        ) : (
          <>
            {/* Strike + phase */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Strike price</p>
                <p className="text-3xl font-bold text-white">
                  {formatOraclePrice(round.strike)}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Round #{roundId?.toString()}
                </p>
              </div>
              <div className="text-right space-y-1">
                <PhaseTag phase={phase!} />
                {phase === "Open" || phase === "Locked" ? (
                  <div>
                    <p className="text-2xl font-mono font-bold text-white">
                      {formatCountdown(secsLeft)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {phase === "Open" ? "until locked" : "until settle"}
                    </p>
                  </div>
                ) : phase === "Settling" ? (
                  <p className="text-xs text-zinc-500">awaiting keeper…</p>
                ) : null}
              </div>
            </div>

            {/* Settled result */}
            {(phase === "Settled" || phase === "Void") && (
              <div className={`rounded-lg border px-4 py-3 text-center ${
                round.outcome.tag === "Above"
                  ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : round.outcome.tag === "Below"
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-zinc-700 bg-zinc-800 text-zinc-400"
              }`}>
                <p className="font-bold text-lg">
                  {round.outcome.tag === "Above"
                    ? "▲ ABOVE WON"
                    : round.outcome.tag === "Below"
                      ? "▼ BELOW WON"
                      : "VOID — full refund"}
                </p>
                {round.settle_price > 0n && (
                  <p className="text-sm opacity-75">
                    Settled at {formatOraclePrice(round.settle_price)}
                  </p>
                )}
              </div>
            )}

            {/* Pools */}
            {(phase === "Open" || phase === "Locked" || phase === "Settling") && (
              <div className="space-y-2">
                {(() => {
                  const poolA = round.pool_above;
                  const poolB = round.pool_below;
                  const total = poolA + poolB;
                  const abovePct = total > 0n ? Number((poolA * 100n) / total) : 50;
                  return (
                    <>
                      <div className="flex h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div className="bg-green-500 transition-all" style={{ width: `${abovePct}%` }} />
                        <div className="flex-1 bg-red-500" />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-400">▲ Above · {formatXlm(poolA)}</span>
                        <span className="text-red-400">{formatXlm(poolB)} · Below ▼</span>
                      </div>
                      {phase === "Open" && total === 0n && (
                        <p className="text-xs text-zinc-600 text-center">No bets yet — be first</p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Settle button (if past settle_ts and wallet connected) */}
            {phase === "Settling" && wallet.address && (
              <button
                onClick={() => void handleSettle()}
                disabled={busy}
                className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-40 transition-colors"
              >
                {busy ? "Check wallet…" : "Settle round"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Next round banner when current is settled */}
      {round && (phase === "Settled" || phase === "Void") && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center space-y-1">
          <p className="text-zinc-400 text-sm">Next round opens after oracle update</p>
          {(() => {
            const nextTick = Math.ceil(nowSec / 300) * 300;
            const secs = Math.max(0, nextTick - nowSec);
            return secs > 0 ? (
              <p className="text-zinc-500 font-mono text-sm">~{formatCountdown(secs)}</p>
            ) : (
              <p className="text-zinc-500 text-xs animate-pulse">Opening now…</p>
            );
          })()}
        </div>
      )}

      {/* Bet form */}
      {round && phase === "Open" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h2 className="font-semibold text-white">Place a bet</h2>

          {!wallet.address ? (
            <button
              onClick={() => void wallet.connect()}
              className="w-full rounded-lg border border-zinc-700 py-2.5 text-sm text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              Connect wallet to bet
            </button>
          ) : position ? (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3">
              <p className="text-sm font-medium text-white">
                You have a position:{" "}
                <span className={position.side.tag === "Above" ? "text-green-400" : "text-red-400"}>
                  {position.side.tag === "Above" ? "▲ Above" : "▼ Below"}
                </span>
                {" · "}
                {formatXlm(position.amount)} ·{" "}
                <span className="text-zinc-400">{position.shares.toString()} shares</span>
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => void handleBet(e)} className="space-y-4">
              {/* Side */}
              <div className="grid grid-cols-2 gap-3">
                <BetButton
                  label="▲ ABOVE"
                  color="green"
                  onClick={() => setSide("Above")}
                  active={side === "Above"}
                  disabled={busy}
                />
                <BetButton
                  label="▼ BELOW"
                  color="red"
                  onClick={() => setSide("Below")}
                  active={side === "Below"}
                  disabled={busy}
                />
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus-within:border-zinc-500">
                  <input
                    type="number"
                    min="10"
                    step="any"
                    placeholder="Min 10 XLM"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                    className="flex-1 bg-transparent text-white placeholder-zinc-600 focus:outline-none"
                  />
                  <span className="text-sm text-zinc-500">XLM</span>
                </div>
                {wallet.balance && (
                  <p className="text-xs text-zinc-600 text-right">
                    Balance:{" "}
                    <button
                      type="button"
                      onClick={() => setAmount((parseFloat(wallet.balance!) * 0.9).toFixed(2))}
                      className="text-zinc-400 hover:text-white underline"
                    >
                      {parseFloat(wallet.balance).toFixed(2)} XLM
                    </button>
                  </p>
                )}
              </div>

              {/* Time-weighted share preview */}
              {previewShares && amount && round && (
                <div className="rounded-lg bg-zinc-800 px-3 py-2 text-xs space-y-1">
                  <p className="text-zinc-400">
                    Shares you receive:{" "}
                    <span className="text-white font-medium">{previewShares.toString()}</span>
                    <span className="text-zinc-600"> (out of max {xlmToStroops(amount).toString()})</span>
                  </p>
                  <p className="text-zinc-600">
                    Betting early gives more shares → larger share of the payout pool.
                  </p>
                </div>
              )}

              {/* Error */}
              {errMsg && <p className="text-xs text-red-400">{errMsg}</p>}

              {/* Submit */}
              {txState === "done" && txResult ? (
                <div className="text-center space-y-1">
                  <p className="text-green-400 font-semibold text-sm">Bet placed ✓</p>
                  <a
                    href={txResult.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 underline"
                  >
                    View transaction →
                  </a>
                  <button
                    type="button"
                    onClick={() => { setTxState("idle"); setSide(null); setAmount(""); }}
                    className="block text-xs text-zinc-500 mx-auto underline"
                  >
                    Place another
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!side || !amount || busy}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  {busy && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
                  {busy ? "Check wallet…" : `Bet ${side ? (side === "Above" ? "Above" : "Below") : ""}`}
                </button>
              )}
            </form>
          )}
        </div>
      )}

      {/* Claim section */}
      {round && (phase === "Settled" || phase === "Void") && wallet.address && position && !position.claimed && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h2 className="font-semibold text-white">Your position</h2>
          {(() => {
            const myShares = position.shares;
            const outcome = round.outcome.tag;
            const isVoid = outcome === "Void";
            const isWinner =
              (outcome === "Above" && position.side.tag === "Above") ||
              (outcome === "Below" && position.side.tag === "Below");

            let payout = 0n;
            if (isVoid) {
              payout = position.amount;
            } else if (isWinner) {
              const winShares = outcome === "Above" ? round.shares_above : round.shares_below;
              const losingPool = outcome === "Above" ? round.pool_below : round.pool_above;
              payout = computePayout(myShares, winShares, losingPool, feeBps);
            }

            return (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Side</span>
                  <span className={position.side.tag === "Above" ? "text-green-400" : "text-red-400"}>
                    {position.side.tag === "Above" ? "▲ Above" : "▼ Below"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Staked</span>
                  <span className="text-white">{formatXlm(position.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Result</span>
                  <span className={isVoid ? "text-zinc-400" : isWinner ? "text-green-400" : "text-red-400"}>
                    {isVoid ? "Void — refund" : isWinner ? "Won" : "Lost"}
                  </span>
                </div>
                {payout > 0n && (
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-white">Claimable</span>
                    <span className="text-green-400">{formatXlm(payout)}</span>
                  </div>
                )}

                {errMsg && <p className="text-xs text-red-400">{errMsg}</p>}

                {txState === "done" && txResult ? (
                  <div className="text-center">
                    <p className="text-green-400 font-semibold text-sm">Claimed ✓</p>
                    <a href={txResult.explorerUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline">
                      View transaction →
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => void handleClaim()}
                    disabled={busy || payout === 0n}
                    className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-black hover:bg-green-500 disabled:opacity-40 transition-colors"
                  >
                    {busy ? "Check wallet…" : isVoid ? `Refund ${formatXlm(payout)}` : payout > 0n ? `Claim ${formatXlm(payout)}` : "Nothing to claim"}
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
