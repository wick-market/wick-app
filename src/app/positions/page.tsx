"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { api, type UserPosition, type ClaimablePosition } from "@/lib/api/client";
import { PositionRow } from "@/components/positions/PositionRow";
import { ClaimButton } from "@/components/positions/ClaimButton";
import { ExpiryCountdown } from "@/components/positions/ExpiryCountdown";
import { formatXlm } from "@/lib/domain/format";

// In mock mode we show fixture positions for this address without requiring
// the user to have a wallet installed.
const MOCK_ADDRESS = "GBGCQGIFNIPDRZ6GN5CFSW5T5KCTGLXDY5HD7ISY6EBDVU7Q2YFBDXUJ";
const IS_MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

export default function PositionsPage() {
  const { address, connected, connect } = useWallet();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [claimable, setClaimable] = useState<ClaimablePosition[]>([]);
  const [loading, setLoading] = useState(true);

  // Use real address when connected, fall back to mock address in mock mode
  const lookupAddress = address ?? (IS_MOCK ? MOCK_ADDRESS : null);

  useEffect(() => {
    if (!lookupAddress) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.allSettled([
      api.getUserPositions(lookupAddress).then(setPositions),
      api.getUserClaimable(lookupAddress).then(setClaimable),
    ]).finally(() => setLoading(false));
  }, [lookupAddress]);

  const totalClaimable = claimable.reduce((sum, c) => sum + BigInt(c.claimable), 0n);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Positions</h1>
        {!connected && (
          <button
            onClick={() => void connect()}
            className="rounded-lg bg-phase-open px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Connect wallet
          </button>
        )}
      </div>

      {/* No wallet, no mock — prompt to connect */}
      {!lookupAddress && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="text-white">Connect your wallet to see positions.</p>
          <button
            onClick={() => void connect()}
            className="rounded-lg bg-phase-open px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Connect wallet
          </button>
        </div>
      )}

      {lookupAddress && loading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-wick-border border-t-phase-open" />
        </div>
      )}

      {lookupAddress && !loading && (
        <>
          {/* Claimable banner */}
          {claimable.length > 0 && (
            <div className="rounded-xl border border-up/30 bg-up-dim/20 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold text-up">Claimable winnings</h2>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatXlm(totalClaimable.toString())}
                  </p>
                  <p className="mt-1 text-xs text-phase-locked">
                    ⚠ Expires 7 days after settlement — funds are permanently lost after that.
                  </p>
                </div>
                <ClaimButton
                  roundId={claimable[0]?.round_id ?? ""}
                  payout={totalClaimable.toString()}
                />
              </div>

              <div className="divide-y divide-wick-border">
                {claimable.map((c) => (
                  <div key={c.round_id} className="flex items-center justify-between py-3 text-sm">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{c.asset}</span>
                        <span
                          className={`text-xs font-semibold ${
                            c.side === "Up" ? "text-up-text" : "text-down-text"
                          }`}
                        >
                          {c.side === "Up" ? "▲ Above" : "▼ Below"}
                        </span>
                      </div>
                      <p className="text-xs text-wick-muted">{formatXlm(c.amount)} staked</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="font-semibold text-up">{formatXlm(c.claimable)}</p>
                      <ExpiryCountdown settledAtIso={new Date(c.settle_ts * 1000).toISOString()} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All positions */}
          <div className="space-y-3">
            <h2 className="font-semibold text-white">All positions</h2>

            {IS_MOCK && !connected && (
              <p className="text-xs text-wick-muted mb-2">
                Showing sample positions · connect a wallet to see your real history
              </p>
            )}

            {positions.length === 0 ? (
              <p className="py-12 text-center text-wick-muted">No positions yet.</p>
            ) : (
              positions.map((p) => (
                <PositionRow key={`${p.round_id}-${p.id}`} position={p} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
