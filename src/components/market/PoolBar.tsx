import { poolSplit } from "@/lib/domain/round";
import type { Round } from "@/lib/domain/round";
import { formatXlm } from "@/lib/domain/format";

export function PoolBar({ round }: { round: Round }) {
  const [upPct, downPct] = poolSplit(round);
  const hasPool = BigInt(round.pool_up) + BigInt(round.pool_down) > 0n;

  return (
    <div className="space-y-1.5">
      {/* Bar */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-wick-border">
        {hasPool ? (
          <>
            <div
              className="bg-up transition-all duration-700"
              style={{ width: `${upPct}%` }}
            />
            <div className="flex-1 bg-down" />
          </>
        ) : (
          <div className="w-full bg-wick-border" />
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs">
        <span className="text-up-text font-medium">↑ {formatXlm(round.pool_up)}</span>
        <span className="text-wick-muted text-center">
          {hasPool ? `${upPct}% / ${downPct}%` : "No bets yet"}
        </span>
        <span className="text-down-text font-medium">{formatXlm(round.pool_down)} ↓</span>
      </div>
    </div>
  );
}
