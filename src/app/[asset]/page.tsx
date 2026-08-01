"use client";

import { notFound } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ASSETS, type Round, type Asset } from "@/lib/domain/round";
import { api } from "@/lib/api/client";
import { useWebSocket, type WsMessage } from "@/lib/api/useWebSocket";
import { useContractRounds } from "@/hooks/useContractRounds";
import { useWallet } from "@/contexts/WalletContext";
import { AssetCard } from "@/components/market/AssetCard";
import { BetForm } from "@/components/round/BetForm";
import { RoundHistory } from "@/components/round/RoundHistory";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

interface Props {
  params: { asset: string };
}

export default function AssetPage({ params }: Props) {
  const asset = params.asset.toUpperCase() as Asset;

  if (!ASSETS.includes(asset)) notFound();

  const { connect, connected } = useWallet();
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Round[]>([]);
  const [mockRound, setMockRound] = useState<Round | null>(null);
  const { rounds: contractRounds, refreshRound } = useContractRounds();

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void api
      .getRoundHistory(asset, 10)
      .then((rs) => setHistory(rs.filter((r) => r.status === "Settled")));

    if (IS_MOCK) {
      void api.getCurrentRounds(asset).then((rs) => {
        if (rs[0]) setMockRound(rs[0]);
      });
    }
  }, [asset]);

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "round" && msg.data.asset === asset && IS_MOCK) {
        setMockRound(msg.data);
      }
      if (msg.type === "price") {
        setPrices((p) => ({ ...p, [msg.asset]: msg.price }));
      }
    },
    [asset]
  );

  useWebSocket(handleMessage);

  // Use real contract round when available, fall back to mock
  const currentRound = contractRounds[asset] ?? mockRound;

  const handleBetConfirmed = useCallback(async () => {
    if (currentRound) {
      await refreshRound(currentRound.round_id, asset);
    }
  }, [currentRound, asset, refreshRound]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {asset} <span className="text-wick-muted font-normal text-xl">/ USD</span>
        </h1>
        {!connected && (
          <button
            onClick={() => void connect()}
            className="rounded-lg bg-phase-open px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Connect to bet
          </button>
        )}
      </div>

      {currentRound ? (
        <>
          <AssetCard
            round={currentRound}
            nowSec={nowSec}
            indicativePrice={prices[asset]}
          />

          <div className="rounded-xl border border-wick-border bg-wick-surface p-5 space-y-4">
            <h2 className="font-semibold text-white">Place a bet</h2>
            <BetForm
              round={currentRound}
              nowSec={nowSec}
              onConfirmed={handleBetConfirmed}
            />
          </div>
        </>
      ) : (
        <div className="flex h-40 items-center justify-center gap-2 rounded-xl border border-wick-border bg-wick-surface">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-wick-border border-t-phase-open" />
          <span className="text-sm text-wick-muted">Reading on-chain state…</span>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-wick-border bg-wick-surface p-5 space-y-3">
          <h2 className="font-semibold text-white">Recent rounds</h2>
          <RoundHistory rounds={history} />
        </div>
      )}
    </div>
  );
}
