"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findActiveRounds, fetchRoundById } from "@/lib/stellar/contractReader";
import { ASSETS, type Round } from "@/lib/domain/round";
import { useWallet } from "@/contexts/WalletContext";

const ASSETS_ARRAY = [...ASSETS];
const POLL_MS = 15_000; // re-read contract every 15s

export function useContractRounds() {
  const { address } = useWallet();
  const [rounds, setRounds] = useState<Record<string, Round>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const found = await findActiveRounds(ASSETS_ARRAY, 30, address ?? undefined);
      setRounds(found);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void load();
    pollRef.current = setInterval(() => void load(), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  /** Refresh a single round after a bet (optimistic pool update) */
  const refreshRound = useCallback(async (roundId: string, asset: string) => {
    const updated = await fetchRoundById(roundId, address ?? undefined);
    if (updated) {
      setRounds((prev) => ({ ...prev, [asset]: updated }));
    }
  }, [address]);

  return { rounds, loading, error, refresh: load, refreshRound };
}
