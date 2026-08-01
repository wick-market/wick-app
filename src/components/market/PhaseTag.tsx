import type { Phase } from "@/lib/domain/round";

const CONFIG: Record<Phase, { label: string; classes: string; pulse?: boolean }> = {
  Open: { label: "OPEN", classes: "bg-phase-open/15 text-phase-open border-phase-open/30" },
  Locked: {
    label: "LOCKED",
    classes: "bg-phase-locked/15 text-phase-locked border-phase-locked/30",
    pulse: true,
  },
  Settling: {
    label: "SETTLING…",
    classes: "bg-phase-settling/15 text-phase-settling border-phase-settling/30",
    pulse: true,
  },
  Settled: { label: "SETTLED", classes: "bg-wick-border/50 text-white border-wick-border" },
  Void: { label: "VOID", classes: "bg-void-dim text-void-text border-void/30" },
};

export function PhaseTag({ phase }: { phase: Phase }) {
  const cfg = CONFIG[phase];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide ${cfg.classes}`}
    >
      {cfg.pulse && (
        <span className="inline-block h-1.5 w-1.5 animate-pulse-fast rounded-full bg-current" />
      )}
      {cfg.label}
    </span>
  );
}
