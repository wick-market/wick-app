import { computeMultiples, bettingWindowProgress } from "@/lib/domain/round";
import { formatMultiple } from "@/lib/domain/format";
import type { Round, Phase } from "@/lib/domain/round";

interface Props {
  round: Round;
  phase: Phase;
  nowSec: number;
}

/**
 * Payout multiples with time-decay indicator.
 *
 * Why early bets are better: in a parimutuel pool, your multiple is
 * distributed / your_side_pool. As more people join your side, that
 * pool grows and your multiple shrinks. Betting early means fewer
 * competitors on your side at the moment you enter.
 *
 * The progress bar shows how much of the betting window has passed.
 * The label is a CORRECTNESS REQUIREMENT — users who think their
 * multiple is fixed will feel cheated when it moves.
 */
export function ProvisionalOdds({ round, phase, nowSec }: Props) {
  const { up, down } = computeMultiples(round);
  const isProvisional = phase === "Open";
  const progress = isProvisional ? bettingWindowProgress(round, nowSec) : null;

  if (!up && !down) {
    return (
      <p className="text-center text-xs text-wick-muted">
        Odds appear once both sides have bets
      </p>
    );
  }

  const urgencyLevel =
    progress === null ? 0 : progress > 0.8 ? 3 : progress > 0.5 ? 2 : progress > 0.25 ? 1 : 0;

  const urgencyColor = ["text-phase-open", "text-phase-open", "text-phase-locked", "text-down"][
    urgencyLevel
  ];

  const windowMessages = [
    "Early bets get the best odds",
    "Odds moving — join sooner next time",
    "Odds getting worse — pool filling fast",
    "Last chance — odds near worst point",
  ];

  return (
    <div className="space-y-2">
      {/* Multiples */}
      <div className="flex justify-between items-center">
        <div className="flex items-baseline gap-1.5">
          <span className="text-up font-bold text-xl">{up ? formatMultiple(up) : "—"}</span>
          <span className="text-up-text text-xs font-semibold">ABOVE</span>
        </div>
        <div className="flex flex-col items-center">
          {isProvisional && (
            <span className="text-[10px] font-bold tracking-widest text-wick-muted">
              PROVISIONAL
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-down-text text-xs font-semibold">BELOW</span>
          <span className="text-down font-bold text-xl">{down ? formatMultiple(down) : "—"}</span>
        </div>
      </div>

      {/* Time-value bar — only when Open */}
      {isProvisional && progress !== null && (
        <div className="space-y-1">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-wick-border">
            <div
              className={`transition-all duration-1000 rounded-full ${
                urgencyLevel >= 2 ? "bg-phase-locked" : "bg-phase-open"
              }`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className={`text-center text-[11px] font-semibold ${urgencyColor}`}>
            {windowMessages[urgencyLevel]} · odds move until lock
          </p>
        </div>
      )}

      {/* Locked state label */}
      {!isProvisional && phase === "Locked" && (
        <p className="text-center text-xs font-semibold text-phase-locked">
          Odds locked — awaiting settlement
        </p>
      )}
    </div>
  );
}
