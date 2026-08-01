import { formatOraclePrice, formatXlm } from "@/lib/domain/format";
import type { Round } from "@/lib/domain/round";

function OutcomePill({ outcome }: { outcome: Round["outcome"] }) {
  if (!outcome) return null;
  const cfg = {
    Up: "text-up-text bg-up-dim border-up/30",
    Down: "text-down-text bg-down-dim border-down/30",
    Void: "text-void-text bg-void-dim border-void/30",
  }[outcome];
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${cfg}`}>
      {outcome === "Up" ? "▲ Above" : outcome === "Down" ? "▼ Below" : "Void"}
    </span>
  );
}

export function RoundHistory({ rounds }: { rounds: Round[] }) {
  if (rounds.length === 0) {
    return <p className="text-center text-sm text-wick-muted py-6">No settled rounds yet.</p>;
  }

  return (
    <div className="divide-y divide-wick-border">
      {rounds.map((r) => {
        const total = BigInt(r.pool_up) + BigInt(r.pool_down);
        return (
          <div key={r.round_id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white">
                  {formatOraclePrice(r.strike, r.asset)}
                </span>
                <OutcomePill outcome={r.outcome} />
              </div>
              {r.settle_price && (
                <p className="mt-0.5 text-xs text-wick-muted">
                  Settled → {formatOraclePrice(r.settle_price, r.asset)}
                </p>
              )}
            </div>
            <div className="text-right text-wick-muted">
              <p>{formatXlm(total.toString())} total</p>
              <p className="text-xs">
                {new Date(r.settle_ts * 1000).toLocaleTimeString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
