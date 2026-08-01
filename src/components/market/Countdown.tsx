"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/domain/format";
import type { Phase } from "@/lib/domain/round";

interface Props {
  targetSec: number; // unix timestamp (seconds) to count down to
  phase: Phase;
}

/**
 * Live countdown to lock_ts (Open phase) or settle_ts (Locked phase).
 * Uses real Date.now() — works correctly with mock-clock's rewritten timestamps
 * because mock-clock sets timestamps to live values relative to now.
 */
export function Countdown({ targetSec, phase }: Props) {
  const [secs, setSecs] = useState(() => Math.max(0, targetSec - Math.floor(Date.now() / 1000)));

  useEffect(() => {
    setSecs(Math.max(0, targetSec - Math.floor(Date.now() / 1000)));
    const id = setInterval(() => {
      setSecs(Math.max(0, targetSec - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [targetSec]);

  const label =
    phase === "Open"
      ? "Lock in"
      : phase === "Locked"
        ? "Settle in"
        : phase === "Settling"
          ? "Awaiting keeper…"
          : null;

  if (!label) return null;

  const isUrgent = secs < 30 && secs > 0;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`font-mono text-2xl font-bold tabular-nums tracking-tight ${
          isUrgent ? "text-phase-locked animate-pulse" : "text-white"
        }`}
      >
        {phase === "Settling" ? "—" : formatCountdown(secs)}
      </span>
      <span className="text-xs text-wick-muted">{label}</span>
    </div>
  );
}
