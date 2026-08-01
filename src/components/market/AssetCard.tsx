"use client";

import Link from "next/link";
import { getPhase } from "@/lib/domain/round";
import { formatOraclePrice } from "@/lib/domain/format";
import type { Round } from "@/lib/domain/round";
import { PhaseTag } from "./PhaseTag";
import { Countdown } from "./Countdown";
import { PoolBar } from "./PoolBar";
import { ProvisionalOdds } from "./ProvisionalOdds";

interface Props {
  round: Round;
  nowSec: number;
  indicativePrice?: string; // from WS price ticker — NOT the settlement price
}

export function AssetCard({ round, nowSec, indicativePrice }: Props) {
  const phase = getPhase(round, nowSec);
  const countdownTarget = phase === "Open" ? round.lock_ts : round.settle_ts;

  const outcomeColor =
    round.outcome === "Up"
      ? "border-up/50 bg-up-dim/20"
      : round.outcome === "Down"
        ? "border-down/50 bg-down-dim/20"
        : round.outcome === "Void"
          ? "border-void/30"
          : "";

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border bg-wick-surface p-5 transition-colors ${
        phase === "Settled" || phase === "Void" ? outcomeColor : "border-wick-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">{round.asset}</h2>
            <PhaseTag phase={phase} />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-sm text-wick-muted">Strike</span>
            <span className="font-mono text-base font-semibold text-white">
              {formatOraclePrice(round.strike, round.asset)}
            </span>
          </div>
          {indicativePrice && (
            <p className="mt-0.5 text-xs text-wick-muted">
              {/* Must be labelled indicative — settlement uses Reflector oracle, not this */}
              Live (indicative): ${indicativePrice}
            </p>
          )}
        </div>

        {/* Countdown */}
        {phase !== "Settled" && phase !== "Void" && (
          <Countdown targetSec={countdownTarget} phase={phase} />
        )}

        {/* Settled outcome */}
        {(phase === "Settled" || phase === "Void") && (
          <div className="text-right">
            <p
              className={`text-xl font-bold ${
                round.outcome === "Up"
                  ? "text-up"
                  : round.outcome === "Down"
                    ? "text-down"
                    : "text-void-text"
              }`}
            >
              {round.outcome === "Up"
                ? "▲ ABOVE"
                : round.outcome === "Down"
                  ? "▼ BELOW"
                  : "VOID"}
            </p>
            {round.settle_price && (
              <p className="mt-0.5 text-xs text-wick-muted">
                Settled at {formatOraclePrice(round.settle_price, round.asset)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Locked state — prominent strike display */}
      {phase === "Locked" && (
        <div className="rounded-lg border border-phase-locked/30 bg-phase-locked/5 px-4 py-2 text-center">
          <p className="text-xs font-semibold text-phase-locked">
            Betting closed · oracle settling at {new Date(round.settle_ts * 1000).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Odds */}
      {(phase === "Open" || phase === "Locked") && (
        <ProvisionalOdds round={round} phase={phase} nowSec={nowSec} />
      )}

      {/* Pool bar */}
      <PoolBar round={round} />

      {/* CTA */}
      {phase === "Open" && (
        <Link
          href={`/${round.asset.toLowerCase()}`}
          className="block w-full rounded-lg bg-phase-open py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Place a bet
        </Link>
      )}
    </div>
  );
}
