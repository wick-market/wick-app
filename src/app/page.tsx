"use client";

import { useCallback, useEffect, useState } from "react";
import { ASSETS, type Round } from "@/lib/domain/round";
import { api } from "@/lib/api/client";
import { useWebSocket, type WsMessage } from "@/lib/api/useWebSocket";
import { AssetCard } from "@/components/market/AssetCard";

/**
 * Market view — shows the current open/locked round for each of the three assets.
 * Live pool sizes and countdown come from the WebSocket feed (real) or mock-clock (mock mode).
 */
export default function MarketPage() {
  const [rounds, setRounds] = useState<Record<string, Round>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [loading, setLoading] = useState(true);

  // Tick every second to keep phase + countdowns live
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Initial load — fetch current round per asset
  useEffect(() => {
    void Promise.allSettled(
      ASSETS.map((asset) =>
        api.getCurrentRounds(asset).then((rs) => {
          if (rs.length > 0 && rs[0]) {
            setRounds((prev) => ({ ...prev, [asset]: rs[0]! }));
          }
        })
      )
    ).finally(() => setLoading(false));
  }, []);

  // WebSocket updates — override round state from live feed
  const handleMessage = useCallback((msg: WsMessage) => {
    if (msg.type === "round") {
      setRounds((prev) => ({ ...prev, [msg.data.asset]: msg.data }));
    }
    if (msg.type === "price") {
      setPrices((prev) => ({ ...prev, [msg.asset]: msg.price }));
    }
  }, []);

  useWebSocket(handleMessage);

  if (loading && Object.keys(rounds).length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wick-border border-t-phase-open" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Markets</h1>
        <p className="mt-1 text-wick-muted">
          Bet above or below in {" "}
          <span className="text-white font-medium">5 minutes</span>. Payouts split the pool.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {ASSETS.map((asset) => {
          const round = rounds[asset];
          if (!round) {
            return (
              <div
                key={asset}
                className="flex h-64 items-center justify-center rounded-xl border border-wick-border bg-wick-surface"
              >
                <p className="text-sm text-wick-muted">{asset} — no active round</p>
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
    </div>
  );
}
