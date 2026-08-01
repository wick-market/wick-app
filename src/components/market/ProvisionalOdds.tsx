import { computeMultiples } from "@/lib/domain/round";
import { formatMultiple } from "@/lib/domain/format";
import type { Round, Phase } from "@/lib/domain/round";

interface Props {
  round: Round;
  phase: Phase;
}

/**
 * Displays the payout multiple for each side with a MANDATORY provisional label
 * when the round is still Open. This label is a correctness requirement, not
 * decoration — users who think their multiple is locked will feel cheated when
 * pool shifts change it.
 */
export function ProvisionalOdds({ round, phase }: Props) {
  const { up, down } = computeMultiples(round);
  const isProvisional = phase === "Open";

  if (!up && !down) {
    return (
      <p className="text-center text-xs text-wick-muted">
        Odds appear once both sides have bets
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-up font-bold text-lg">{up ? formatMultiple(up) : "—"}</span>
          <span className="text-up-text text-xs">ABOVE</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-down-text text-xs">BELOW</span>
          <span className="text-down font-bold text-lg">{down ? formatMultiple(down) : "—"}</span>
        </div>
      </div>
      {isProvisional && (
        <p className="text-center text-xs font-semibold text-phase-locked">
          PROVISIONAL — moves until lock
        </p>
      )}
    </div>
  );
}
