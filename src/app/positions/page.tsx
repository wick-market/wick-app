"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getCurrentRoundId,
  getRound,
  getPosition,
  getXlmBalance,
  claim,
  parseError,
  formatOraclePrice,
  formatXlm,
  computeWinnerPayout,
  computeLoserPayout,
  type Round,
  type Position,
  type TxResult,
} from "@/lib/stellar/predict";
import { openConnectModal, getAddress, disconnect } from "@/lib/stellar/wallet";

function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const refresh = useCallback(async (addr: string) => {
    const b = await getXlmBalance(addr); setBalance(b);
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

function Header({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">Wick</span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">TESTNET</span>
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/" className="text-zinc-300 hover:text-white transition-colors font-medium">Markets</Link>
            <Link href="/positions" className="text-white font-medium">Positions</Link>
          </nav>
        </div>
        {wallet.address ? (
          <div className="flex items-center gap-2">
            {wallet.balance && (
              <span className="text-sm text-zinc-400">
                <span className="text-white font-medium">{parseFloat(wallet.balance).toFixed(2)}</span> XLM
              </span>
            )}
            <button onClick={() => void wallet.disconnect()}
              className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-white transition-colors">
              {wallet.address.slice(0, 5)}…{wallet.address.slice(-4)}
            </button>
          </div>
        ) : (
          <button onClick={() => void wallet.connect()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}

interface PositionEntry {
  roundId: bigint;
  round: Round;
  position: Position;
}

export default function PositionsPage() {
  const wallet = useWallet();
  const [entries, setEntries] = useState<PositionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimStates, setClaimStates] = useState<Record<string, "idle" | "signing" | "done" | "error">>({});
  const [claimResults, setClaimResults] = useState<Record<string, TxResult>>({});
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});

  const load = useCallback(async (addr: string) => {
    setLoading(true);
    try {
      const latestId = await getCurrentRoundId();
      const found: PositionEntry[] = [];
      // Scan last 20 rounds
      const start = latestId > 20n ? latestId - 20n : 1n;
      for (let id = latestId; id >= start; id--) {
        const [round, pos] = await Promise.all([getRound(id), getPosition(id, addr)]);
        if (round && pos) found.push({ roundId: id, round, position: pos });
      }
      setEntries(found);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (wallet.address) void load(wallet.address);
  }, [wallet.address, load]);

  async function handleClaim(roundId: bigint) {
    if (!wallet.address) return;
    const key = roundId.toString();
    setClaimStates((s) => ({ ...s, [key]: "signing" }));
    try {
      const res = await claim(wallet.address, roundId);
      setClaimResults((s) => ({ ...s, [key]: res }));
      setClaimStates((s) => ({ ...s, [key]: "done" }));
      void wallet.refresh(wallet.address);
      void load(wallet.address);
    } catch (e) {
      setClaimErrors((s) => ({ ...s, [key]: parseError(e) }));
      setClaimStates((s) => ({ ...s, [key]: "error" }));
    }
  }

  const FEE_BPS = 200n;

  function calcPayout(entry: PositionEntry): bigint {
    const { round, position } = entry;
    if (round.status.tag !== "Settled") return 0n;
    if (round.outcome.tag === "Void") return position.amount;
    const isWinner =
      (round.outcome.tag === "Above" && position.side.tag === "Above") ||
      (round.outcome.tag === "Below" && position.side.tag === "Below");
    const losingPool = round.outcome.tag === "Above" ? round.pool_below : round.pool_above;
    const fee = losingPool * FEE_BPS / 10_000n;
    const dist = losingPool - fee;
    if (isWinner) {
      const sideBoosted = round.outcome.tag === "Above" ? round.boosted_above : round.boosted_below;
      return computeWinnerPayout(position.amount, dist, position.boosted, sideBoosted, round.global_boosted);
    }
    return computeLoserPayout(dist, position.boosted, round.global_boosted);
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header wallet={wallet} />
      <div className="mx-auto max-w-xl px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-white">My Positions</h1>

        {!wallet.address ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center space-y-3">
            <p className="text-zinc-400">Connect your wallet to see positions</p>
            <button onClick={() => void wallet.connect()}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              Connect Wallet
            </button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-zinc-500">No positions yet</p>
            <Link href="/" className="mt-3 block text-sm text-blue-400 underline">Place your first bet →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const { roundId, round, position } = entry;
              const key = roundId.toString();
              const claimState = claimStates[key] ?? "idle";
              const payout = calcPayout(entry);
              const isSettled = round.status.tag === "Settled";
              const isVoid = round.outcome.tag === "Void";
              const isWinner = isSettled && !isVoid && (
                (round.outcome.tag === "Above" && position.side.tag === "Above") ||
                (round.outcome.tag === "Below" && position.side.tag === "Below")
              );
              const isLoser = isSettled && !isVoid && !isWinner;
              const canClaim = isSettled && !position.claimed && payout > 0n;

              return (
                <div key={key}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                  {/* Round info */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">Round #{key}</span>
                        <span className={`text-xs font-semibold ${
                          position.side.tag === "Above" ? "text-green-400" : "text-red-400"
                        }`}>
                          {position.side.tag === "Above" ? "▲ Above" : "▼ Below"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Strike {formatOraclePrice(round.strike)} · {formatXlm(position.amount)} staked
                      </p>
                    </div>
                    <div className="text-right">
                      {!isSettled && (
                        <span className="text-xs text-zinc-500">
                          {round.status.tag === "Open" ? "● Open" : "● Locked"}
                        </span>
                      )}
                      {isSettled && (
                        <span className={`text-sm font-bold ${
                          isVoid ? "text-zinc-400" : isWinner ? "text-green-400" : "text-amber-400"
                        }`}>
                          {isVoid ? "VOID" : isWinner ? "WON" : "LOST"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Settled state */}
                  {isSettled && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-400">
                        {isVoid && "Full refund (void round)"}
                        {isWinner && `Payout: `}
                        {isLoser && "Partial refund: "}
                        {(isWinner || isLoser) && (
                          <span className={isWinner ? "text-green-400 font-semibold" : "text-amber-400 font-semibold"}>
                            {formatXlm(payout)}
                          </span>
                        )}
                        {isVoid && (
                          <span className="text-zinc-300 font-semibold ml-1">{formatXlm(payout)}</span>
                        )}
                      </div>

                      {canClaim && (
                        claimState === "done" ? (
                          <div className="text-right">
                            <span className="text-green-400 text-sm font-semibold">Claimed ✓</span>
                            {claimResults[key] && (
                              <a href={claimResults[key].explorerUrl} target="_blank" rel="noreferrer"
                                className="block text-xs text-blue-400 underline">View tx →</a>
                            )}
                          </div>
                        ) : position.claimed ? (
                          <span className="text-xs text-zinc-600">Already claimed</span>
                        ) : (
                          <div className="text-right">
                            <button
                              onClick={() => void handleClaim(roundId)}
                              disabled={claimState === "signing"}
                              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                                isWinner ? "bg-green-600 text-black hover:bg-green-500"
                                  : "bg-amber-600 text-black hover:bg-amber-500"
                              }`}>
                              {claimState === "signing" ? "Check wallet…" : `Claim ${formatXlm(payout)}`}
                            </button>
                            {claimErrors[key] && (
                              <p className="text-xs text-red-400 mt-1">{claimErrors[key]}</p>
                            )}
                          </div>
                        )
                      )}
                      {isSettled && !canClaim && position.claimed && (
                        <span className="text-xs text-zinc-600">Claimed</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
