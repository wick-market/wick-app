"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useContractRounds } from "@/hooks/useContractRounds";
import { ASSETS, getPhase, type Round } from "@/lib/domain/round";
import { api } from "@/lib/api/client";
import { useWebSocket, type WsMessage } from "@/lib/api/useWebSocket";
import { AssetCard } from "@/components/market/AssetCard";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

// ── Connect prompt ────────────────────────────────────────────────────────────

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Predict the market
        </h1>
        <p className="max-w-md text-lg text-wick-muted">
          Stake XLM on whether BTC, ETH, or SOL closes above or below the
          current price in 5 minutes. Winners split the pool.
        </p>
      </div>

      <div className="grid max-w-sm gap-4 text-left text-sm text-wick-muted">
        {[
          ["⏱", "5-minute rounds", "A new price window opens every 5 minutes"],
          ["📊", "Parimutuel payouts", "Winners split the entire losing pool"],
          ["🔒", "Locked odds", "Betting closes 3 minutes in — no last-second edge"],
        ].map(([icon, title, desc]) => (
          <div key={title} className="flex gap-3">
            <span className="text-xl">{icon}</span>
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onConnect}
        className="rounded-xl bg-phase-open px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:opacity-90 hover:shadow-phase-open/30"
      >
        Connect wallet to start
      </button>

      <p className="text-xs text-wick-muted">
        Testnet only · Freighter, xBull, Albedo supported
      </p>
    </div>
  );
}

// ── Market view ───────────────────────────────────────────────────────────────

function MarketView() {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [mockRounds, setMockRounds] = useState<Record<string, Round>>({});
  const { rounds: contractRounds, loading, error } = useContractRounds();

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Mock data fallback for UI development
  useEffect(() => {
    if (!IS_MOCK) return;
    void Promise.allSettled(
      [...ASSETS].filter(a => a !== "XLM").map((asset) =>
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

  // Prefer real contract rounds; fall back to MSW mock rounds in dev
  const rounds = Object.keys(contractRounds).length > 0 ? contractRounds : mockRounds;
  const activeAssets = [...ASSETS].filter((a) => a !== "XLM");

  if (loading && Object.keys(rounds).length === 0) {
    return (
      <div className="flex items-center justify-center py-24 gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-wick-border border-t-phase-open" />
        <span className="text-sm text-wick-muted">Reading on-chain rounds…</span>
      </div>
    );
  }

  if (error && Object.keys(rounds).length === 0) {
    return (
      <div className="rounded-lg border border-down/30 bg-down-dim/20 px-4 py-3 text-center text-sm text-down">
        Could not read contract: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Markets</h1>
        <p className="mt-1 text-sm text-wick-muted">
          Bet above or below in <span className="text-white font-medium">5 minutes</span>.
          Betting closes 3 minutes in. Winners split the pot.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {activeAssets.map((asset) => {
          const round = rounds[asset];
          if (!round) {
            return (
              <div
                key={asset}
                className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-wick-border bg-wick-surface"
              >
                <p className="text-sm font-semibold text-white">{asset}</p>
                <p className="text-xs text-wick-muted">No active round — keeper will open one</p>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const { connected, connect } = useWallet();

  if (!connected) {
    return <ConnectPrompt onConnect={() => void connect()} />;
  }

  return <MarketView />;
}
