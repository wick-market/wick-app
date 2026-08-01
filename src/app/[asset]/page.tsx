"use client";

import { notFound } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ASSETS, type Round, type Asset } from "@/lib/domain/round";
import { api } from "@/lib/api/client";
import { useWebSocket, type WsMessage } from "@/lib/api/useWebSocket";
import { AssetCard } from "@/components/market/AssetCard";
import { BetForm } from "@/components/round/BetForm";
import { RoundHistory } from "@/components/round/RoundHistory";

interface Props {
  params: { asset: string };
}

export default function AssetPage({ params }: Props) {
  const asset = params.asset.toUpperCase() as Asset;

  // XLM is not a frontend asset even though the contract accepts it.
  if (!ASSETS.includes(asset)) notFound();

  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [history, setHistory] = useState<Round[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void api
      .getCurrentRounds(asset)
      .then((rs) => { if (rs[0]) setCurrentRound(rs[0]); });

    void api
      .getRoundHistory(asset, 10)
      .then((rs) => setHistory(rs.filter((r) => r.status === "Settled")));
  }, [asset]);

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "round" && msg.data.asset === asset) {
        setCurrentRound(msg.data);
      }
      if (msg.type === "price") {
        setPrices((p) => ({ ...p, [msg.asset]: msg.price }));
      }
    },
    [asset]
  );

  useWebSocket(handleMessage);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">{asset} / USD</h1>

      {currentRound ? (
        <>
          <AssetCard round={currentRound} nowSec={nowSec} indicativePrice={prices[asset]} />

          <div className="rounded-xl border border-wick-border bg-wick-surface p-5 space-y-4">
            <h2 className="font-semibold text-white">Place a bet</h2>
            <BetForm round={currentRound} nowSec={nowSec} />
          </div>
        </>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-wick-border bg-wick-surface">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-wick-border border-t-phase-open" />
        </div>
      )}

      <div className="rounded-xl border border-wick-border bg-wick-surface p-5 space-y-3">
        <h2 className="font-semibold text-white">Recent rounds</h2>
        <RoundHistory rounds={history} />
      </div>
    </div>
  );
}
