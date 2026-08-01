import { formatOraclePrice, formatXlm } from "@/lib/domain/format";
import { computePayout, type Round } from "@/lib/domain/round";
import type { UserPosition } from "@/lib/api/client";
import { ClaimButton } from "./ClaimButton";
import { ExpiryCountdown } from "./ExpiryCountdown";

interface Props {
  position: UserPosition;
}

export function PositionRow({ position: p }: Props) {
  const isSettled = p.status === "Settled";
  const isWinner =
    isSettled &&
    p.outcome !== "Void" &&
    p.outcome !== null &&
    p.side === p.outcome;
  const isVoid = isSettled && p.outcome === "Void";

  // Cast UserPosition to Round for payout math — they share the required fields.
  const payout =
    isSettled && p.outcome !== null
      ? computePayout(p.amount, p.side, p as unknown as Round)
      : null;

  const isClaimbable = payout !== null && payout > 0n;

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-wick-border bg-wick-surface px-4 py-3">
      {/* Left: asset + side + round */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-white">{p.asset}</span>
          <span
            className={`rounded border px-2 py-0.5 text-xs font-semibold ${
              p.side === "Up"
                ? "border-up/30 text-up-text bg-up-dim"
                : "border-down/30 text-down-text bg-down-dim"
            }`}
          >
            {p.side === "Up" ? "▲ Above" : "▼ Below"}
          </span>
          {isVoid && (
            <span className="rounded border border-void/30 bg-void-dim px-2 py-0.5 text-xs text-void-text">
              Void — refunded
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-wick-muted">
          Strike: {formatOraclePrice(p.strike, p.asset)} · {formatXlm(p.amount)}
        </p>
        {isSettled && p.settle_price && (
          <p className="mt-0.5 text-xs text-wick-muted">
            Settled: {formatOraclePrice(p.settle_price, p.asset)}
            {" · "}
            <span className={isWinner ? "text-up-text" : isVoid ? "text-void-text" : "text-down"}>
              {isWinner ? "WON" : isVoid ? "VOID" : "LOST"}
            </span>
          </p>
        )}
        {!isSettled && (
          <p className="mt-0.5 text-xs text-wick-muted">
            Settle at {new Date(p.settle_ts * 1000).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Right: claim or status */}
      <div className="flex-shrink-0 text-right">
        {isClaimbable && p.settled_at ? (
          <div className="flex flex-col items-end gap-1">
            <ClaimButton roundId={p.round_id} payout={payout.toString()} />
            <ExpiryCountdown settledAtIso={p.settled_at} />
          </div>
        ) : isSettled && !isClaimbable && !isVoid ? (
          <span className="text-sm text-wick-muted">—</span>
        ) : !isSettled ? (
          <span className="text-xs text-wick-muted">Pending</span>
        ) : null}
      </div>
    </div>
  );
}
