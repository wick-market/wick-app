"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getCurrentRoundId,
  getRound,
  getPosition,
  getXlmBalance,
  betAbove,
  betBelow,
  settle,
  parseError,
  formatOraclePrice,
  formatXlm,
  xlmToStroops,
  computeBoosted,
  computeWinnerPayout,
  computeLoserPayout,
  type Round,
  type Position,
  type TxResult,
} from "@/lib/stellar/predict";
import { openConnectModal, getAddress, disconnect } from "@/lib/stellar/wallet";

// ── Wallet ────────────────────────────────────────────────────────────────────

function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const refresh = useCallback(async (addr: string) => {
    const b = await getXlmBalance(addr);
    setBalance(b);
  }, []);

  useEffect(() => {
    getAddress().then((a) => { if (a) { setAddress(a); void refresh(a); } });
  }, [refresh]);

  const connect = useCallback(async () => {
    await openConnectModal((a) => { setAddress(a); void refresh(a); });
  }, [refresh]);

  const doDisconnect = useCallback(async () => {
    await disconnect(); setAddress(null); setBalance(null);
  }, []);

  return { address, balance, connect, disconnect: doDisconnect, refresh };
}

// ── Live price from Binance (display only — NOT the settlement price) ─────────

function useLivePrice() {
  const [price, setPrice] = useState<string | null>(null);
  useEffect(() => {
    const fetch_ = async () => {
      try {
        // CoinGecko — works from all regions, no API key needed
        const r = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
          { headers: { Accept: "application/json" } }
        );
        const d = (await r.json()) as { stellar?: { usd: number } };
        if (d.stellar?.usd) setPrice(d.stellar.usd.toFixed(4));
      } catch {
        // Fallback: Binance
        try {
          const r2 = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=XLMUSDT");
          const d2 = (await r2.json()) as { price: string };
          setPrice(parseFloat(d2.price).toFixed(4));
        } catch { /* ignore */ }
      }
    };
    void fetch_();
    const id = setInterval(() => void fetch_(), 10_000);
    return () => clearInterval(id);
  }, []);
  return price;
}

// ── Round ─────────────────────────────────────────────────────────────────────

function useRound() {
  const [roundId, setRoundId] = useState<bigint | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const poll = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    try {
      const id = await getCurrentRoundId();
      if (id > 0n) {
        setRoundId(id);
        const r = await getRound(id);
        setRound(r);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    poll.current = setInterval(() => void load(), 10_000);
    return () => clearInterval(poll.current);
  }, [load]);

  return { roundId, round, loading, refresh: load };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Phase = "Open" | "Locked" | "Settling" | "Settled" | "Void";

function getPhase(round: Round, now: number): Phase {
  const s = round.status.tag;
  if (s === "Settled") return round.outcome.tag === "Void" ? "Void" : "Settled";
  if (now >= Number(round.settle_ts)) return "Settling";
  if (now >= Number(round.lock_ts)) return "Locked";
  return "Open";
}

function fmt(secs: number) {
  if (secs <= 0) return "00:00";
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">Wick</span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
              TESTNET
            </span>
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/" className="text-white font-medium">Markets</Link>
            <Link href="/positions" className="text-zinc-300 hover:text-white transition-colors font-medium">Positions</Link>
          </nav>
        </div>
        {wallet.address ? (
          <div className="flex items-center gap-2">
            {wallet.balance && (
              <span className="text-sm text-zinc-400">
                <span className="text-white font-medium">
                  {parseFloat(wallet.balance).toFixed(2)}
                </span>{" "}XLM
              </span>
            )}
            <button
              onClick={() => void wallet.disconnect()}
              className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              {wallet.address.slice(0, 5)}…{wallet.address.slice(-4)}
            </button>
          </div>
        ) : (
          <button
            onClick={() => void wallet.connect()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}

// ── Phase badge ───────────────────────────────────────────────────────────────

function PhaseBadge({ phase }: { phase: Phase }) {
  const s: Record<Phase, string> = {
    Open:     "bg-green-500/15 text-green-400 border-green-500/30",
    Locked:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
    Settling: "bg-purple-500/15 text-purple-400 border-purple-500/30 animate-pulse",
    Settled:  "bg-zinc-700/50 text-zinc-300 border-zinc-600",
    Void:     "bg-zinc-700/50 text-zinc-400 border-zinc-600",
  };
  const l: Record<Phase, string> = {
    Open: "● OPEN", Locked: "● LOCKED", Settling: "● SETTLING…",
    Settled: "SETTLED", Void: "VOID",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide ${s[phase]}`}>
      {l[phase]}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const wallet = useWallet();
  const { roundId, round, loading, refresh } = useRound();
  const livePrice = useLivePrice();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [position, setPosition] = useState<Position | null>(null);
  const [side, setSide] = useState<"Above" | "Below" | null>(null);
  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!wallet.address || !roundId) return;
    void getPosition(roundId, wallet.address).then(setPosition);
  }, [wallet.address, roundId]);

  const phase = round ? getPhase(round, now) : null;
  const countdownTo = round ? (phase === "Open" ? Number(round.lock_ts) : Number(round.settle_ts)) : 0;
  const secs = Math.max(0, countdownTo - now);

  // Price delta from strike
  const strikeUsd = round ? Number(round.strike) / 1e14 : null;
  const currentUsd = livePrice ? parseFloat(livePrice) : null;
  const delta = strikeUsd && currentUsd ? currentUsd - strikeUsd : null;
  const deltaPct = delta && strikeUsd ? (delta / strikeUsd) * 100 : null;

  // Potential payout preview
  const FEE_BPS = 200n;
  function previewPayout(betSide: "Above" | "Below", betAmt: string): { win: string; refund: string } | null {
    if (!round || !betAmt || !roundId) return null;
    const stroops = xlmToStroops(betAmt);
    if (stroops <= 0n) return null;
    const boosted = computeBoosted(stroops, now, Number(round.lock_ts));
    const losingPool = betSide === "Above" ? round.pool_below : round.pool_above;
    const fee = losingPool * FEE_BPS / 10_000n;
    const dist = losingPool - fee;
    if (dist <= 0n) return { win: formatXlm(stroops), refund: "—" };
    const sideBoosted = (betSide === "Above" ? round.boosted_above : round.boosted_below) + boosted;
    const globalBoosted = round.global_boosted + boosted;
    const winPay = computeWinnerPayout(stroops, dist, boosted, sideBoosted, globalBoosted);
    const loseRefund = computeLoserPayout(dist, boosted, globalBoosted);
    return { win: formatXlm(winPay), refund: formatXlm(loseRefund) };
  }

  const preview = side && amount ? previewPayout(side, amount) : null;

  async function handleBet(e: React.FormEvent) {
    e.preventDefault();
    if (!side || !amount || !roundId || !wallet.address) return;
    setTxState("signing"); setErr(null); setTxResult(null);
    try {
      const stroops = xlmToStroops(amount);
      const res = side === "Above"
        ? await betAbove(wallet.address, roundId, stroops)
        : await betBelow(wallet.address, roundId, stroops);
      setTxResult(res); setTxState("done");
      void refresh();
      void wallet.refresh(wallet.address);
      void getPosition(roundId, wallet.address).then(setPosition);
    } catch (e2) { setTxState("error"); setErr(parseError(e2)); }
  }

  async function handleSettle() {
    if (!roundId || !wallet.address) return;
    setTxState("signing"); setErr(null);
    try {
      await settle(roundId, wallet.address);
      setTxState("idle"); void refresh();
    } catch (e2) { setTxState("error"); setErr(parseError(e2)); }
  }

  const busy = txState === "signing";

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header wallet={wallet} />

      <div className="mx-auto max-w-xl px-4 py-6 space-y-4">

        {/* Loading */}
        {loading && !round && (
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
            <span className="text-zinc-500 text-sm">Reading from chain…</span>
          </div>
        )}

        {/* Between rounds — show price and last result */}
        {!loading && (!round || phase === "Settled" || phase === "Void") && (
          <div className="space-y-3">
            {/* Current price card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">XLM / USD · Live</p>
                  <p className="text-4xl font-bold text-white font-mono">
                    ${livePrice ?? "—"}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500 ml-auto" />
                  <p className="text-xs text-zinc-500">Next round opening…</p>
                </div>
              </div>
            </div>

            {/* Last round result */}
            {round && (phase === "Settled" || phase === "Void") && (
              <div className={`rounded-xl border p-4 ${
                round.outcome.tag === "Above" ? "border-green-500/20 bg-green-500/5"
                : round.outcome.tag === "Below" ? "border-red-500/20 bg-red-500/5"
                : "border-zinc-800 bg-zinc-900"
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Last round #{roundId?.toString()}</p>
                    <p className={`font-bold ${
                      round.outcome.tag === "Above" ? "text-green-400"
                      : round.outcome.tag === "Below" ? "text-red-400"
                      : "text-zinc-400"
                    }`}>
                      {round.outcome.tag === "Above" ? "▲ ABOVE won"
                        : round.outcome.tag === "Below" ? "▼ BELOW won"
                        : "VOID — refunded"}
                    </p>
                  </div>
                  {round.settle_price > 0n && (
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Settled at</p>
                      <p className="font-mono text-white">${(Number(round.settle_price) / 1e14).toFixed(4)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-zinc-600">
              Run the demo keeper to start automatic 1-minute rounds
            </p>
          </div>
        )}

        {/* Active round */}
        {round && phase && phase !== "Settled" && phase !== "Void" && (
          <>
            {/* Round card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">

              {/* Top row: asset + phase + countdown */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-white">XLM / USD</span>
                    <PhaseBadge phase={phase} />
                  </div>
                  <p className="text-zinc-600 text-xs">Round #{roundId?.toString()}</p>
                </div>
                {phase !== "Settling" && (
                  <div className="text-right">
                    <p className="font-mono text-2xl font-bold text-white">{fmt(secs)}</p>
                    <p className="text-xs text-zinc-500">
                      {phase === "Open" ? "until locked" : "until settle"}
                    </p>
                  </div>
                )}
              </div>

              {/* Price comparison: strike vs now */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-zinc-800 px-3 py-2.5">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
                    Strike (round opened)
                  </p>
                  <p className="text-lg font-bold text-white font-mono">
                    ${strikeUsd?.toFixed(4) ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-800 px-3 py-2.5">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
                    Current · indicative
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg font-bold text-white font-mono">
                      ${livePrice ?? "…"}
                    </p>
                    {deltaPct !== null && (
                      <span className={`text-xs font-semibold ${delta! > 0 ? "text-green-400" : delta! < 0 ? "text-red-400" : "text-zinc-500"}`}>
                        {delta! > 0 ? "▲" : delta! < 0 ? "▼" : "●"}{" "}
                        {Math.abs(deltaPct).toFixed(3)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pool bar */}
              {(() => {
                const a = round.pool_above, b = round.pool_below;
                const total = a + b;
                const pct = total > 0n ? Number((a * 100n) / total) : 50;
                return (
                  <div className="space-y-1.5">
                    <div className="flex h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div className="bg-green-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                      <div className="flex-1 bg-red-500" />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-green-400">▲ Above · {formatXlm(a)}</span>
                      <span className="text-red-400">{formatXlm(b)} · Below ▼</span>
                    </div>
                    {total === 0n && (
                      <p className="text-center text-xs text-zinc-600">No bets yet — be first</p>
                    )}
                  </div>
                );
              })()}

              {/* Settle button */}
              {phase === "Settling" && wallet.address && (
                <button
                  onClick={() => void handleSettle()}
                  disabled={busy}
                  className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-40 transition-colors"
                >
                  {busy ? "Check wallet…" : "Settle round"}
                </button>
              )}
            </div>

            {/* Bet form */}
            {phase === "Open" && (
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
                    <p className="text-sm text-white">
                      Your position:{" "}
                      <span className={position.side.tag === "Above" ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                        {position.side.tag === "Above" ? "▲ Above" : "▼ Below"}
                      </span>
                      {" · "}{formatXlm(position.amount)}
                    </p>
                  </div>
                ) : txState === "done" && txResult ? (
                  <div className="text-center space-y-2">
                    <p className="text-green-400 font-semibold">Bet placed ✓</p>
                    <a href={txResult.explorerUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-400 underline">
                      View transaction →
                    </a>
                    <button onClick={() => { setTxState("idle"); setSide(null); setAmount(""); }}
                      className="block text-xs text-zinc-500 mx-auto underline">Place another</button>
                  </div>
                ) : (
                  <form onSubmit={(e) => void handleBet(e)} className="space-y-3">
                    {/* Side buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      {(["Above", "Below"] as const).map((s) => (
                        <button key={s} type="button"
                          onClick={() => { setSide(s); setTxState("idle"); setErr(null); }}
                          disabled={busy}
                          className={`rounded-lg border py-3 text-sm font-bold transition-all disabled:opacity-30 ${
                            side === s
                              ? s === "Above"
                                ? "border-green-500 bg-green-500/15 text-green-400"
                                : "border-red-500 bg-red-500/15 text-red-400"
                              : s === "Above"
                                ? "border-zinc-700 text-zinc-400 hover:border-green-500/50 hover:text-green-400"
                                : "border-zinc-700 text-zinc-400 hover:border-red-500/50 hover:text-red-400"
                          }`}>
                          {s === "Above" ? "▲ ABOVE" : "▼ BELOW"}
                        </button>
                      ))}
                    </div>

                    {/* Amount */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus-within:border-zinc-500">
                        <input
                          type="number" min="10" step="any"
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
                          <button type="button"
                            onClick={() => setAmount((parseFloat(wallet.balance!) * 0.9).toFixed(2))}
                            className="text-zinc-400 hover:text-white underline">
                            {parseFloat(wallet.balance).toFixed(2)} XLM
                          </button>
                        </p>
                      )}
                    </div>

                    {/* Payout preview */}
                    {preview && side && (
                      <div className="rounded-lg bg-zinc-800 px-3 py-2.5 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">If {side} wins</span>
                          <span className="text-green-400 font-semibold">{preview.win}</span>
                        </div>
                        {preview.refund !== "—" && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">If {side === "Above" ? "Below" : "Above"} wins</span>
                            <span className="text-amber-400">{preview.refund} back</span>
                          </div>
                        )}
                      </div>
                    )}

                    {err && <p className="text-xs text-red-400">{err}</p>}

                    <button
                      type="submit"
                      disabled={!side || !amount || busy}
                      className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                    >
                      {busy && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
                      {busy ? "Check wallet…" : `Bet ${side ? (side === "Above" ? "▲ Above" : "▼ Below") : ""}`}
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}

        {/* Testnet note */}
        <p className="text-center text-xs text-zinc-700">
          Testnet only · XLM has no real value ·{" "}
          <a href="https://friendbot.stellar.org" target="_blank" rel="noreferrer"
            className="underline hover:text-zinc-500">Get free XLM</a>
        </p>
      </div>
    </div>
  );
}
