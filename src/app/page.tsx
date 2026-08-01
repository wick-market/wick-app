"use client";

import { useCallback, useEffect, useState } from "react";
import { useContractRounds } from "@/hooks/useContractRounds";
import { ASSETS, type Round } from "@/lib/domain/round";
import { api } from "@/lib/api/client";
import { useWebSocket, type WsMessage } from "@/lib/api/useWebSocket";
import { AssetCard } from "@/components/market/AssetCard";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

export default function MarketPage() {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [mockRounds, setMockRounds] = useState<Record<string, Round>>({});
  const { rounds: contractRounds, loading } = useContractRounds();

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Mock data for assets the contract doesn't have active rounds for
  useEffect(() => {
    if (!IS_MOCK) return;
    void Promise.allSettled(
      ASSETS.map((asset) =>
        api.getCurrentRounds(asset).then((rs) => {
          if (rs[0]) setMockRounds((p) => ({ ...p, [asset]: rs[0]! }));
        })
      )
    );
  }, []);

  const handleMessage = useCallback((msg: WsMessage) => {
    if (msg.type === "round" && IS_MOCK) {
      setMockRounds((p) => ({ ...p, [msg.data.asset]: msg.data }));
    }
    if (msg.type === "price") {
      setPrices((p) => ({ ...p, [msg.asset]: msg.price }));
    }
  }, []);

  useWebSocket(handleMessage);

  // Real contract rounds take priority; fall back to mock for any missing asset
  const rounds: Record<string, Round> = { ...mockRounds, ...contractRounds };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Markets</h1>
        <p className="mt-1 text-sm text-wick-muted">
          Bet above or below in{" "}
          <span className="text-white font-medium">5 minutes</span>. Betting
          closes 3 minutes in. Winners split the pot.
        </p>
      </div>

      {loading && Object.keys(rounds).length === 0 ? (
        <div className="flex items-center gap-3 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-wick-border border-t-phase-open" />
          <span className="text-sm text-wick-muted">Loading markets…</span>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {ASSETS.map((asset) => {
            const round = rounds[asset];
            if (!round) {
              return (
                <div
                  key={asset}
                  className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-wick-border bg-wick-surface"
                >
                  <p className="font-semibold text-white">{asset}</p>
                  <p className="text-xs text-wick-muted text-center px-4">
                    No active round
                  </p>
                </div>
              );
            }
            return (
              <AssetCard
                key={asset}
                round={round}
                nowSec={nowSec}
                indicativePrice={prices[asset]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
