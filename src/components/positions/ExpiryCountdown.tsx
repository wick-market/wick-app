"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/domain/format";

const SEVEN_DAYS_SECS = 7 * 24 * 3600;
const ONE_DAY_SECS = 24 * 3600;

interface Props {
  settledAtIso: string; // ISO timestamp when the round was settled
}

/**
 * Shows how many days/hours a user has to claim before the on-chain entry
 * expires (7-day storage TTL). Funds are PERMANENTLY LOST after expiry.
 * This countdown turns red when under 24 hours — do not make it subtle.
 */
export function ExpiryCountdown({ settledAtIso }: Props) {
  const settledAtSec = Math.floor(new Date(settledAtIso).getTime() / 1000);
  const expirySec = settledAtSec + SEVEN_DAYS_SECS;

  const [secsLeft, setSecsLeft] = useState(() =>
    Math.max(0, expirySec - Math.floor(Date.now() / 1000))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSecsLeft(Math.max(0, expirySec - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [expirySec]);

  if (secsLeft === 0) {
    return (
      <span className="text-xs font-bold text-down">EXPIRED — funds lost</span>
    );
  }

  const daysLeft = Math.floor(secsLeft / ONE_DAY_SECS);
  const isUrgent = secsLeft < ONE_DAY_SECS;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        isUrgent ? "text-down animate-pulse" : "text-phase-locked"
      }`}
    >
      {isUrgent ? (
        <>⚠ Expires in {formatCountdown(secsLeft)}</>
      ) : (
        <>Expires in {daysLeft}d</>
      )}
    </span>
  );
}
