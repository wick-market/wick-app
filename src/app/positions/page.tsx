"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { api, type UserPosition, type ClaimablePosition } from "@/lib/api/client";
import { PositionRow } from "@/components/positions/PositionRow";
import { ClaimButton } from "@/components/positions/ClaimButton";
import { ExpiryCountdown } from "@/components/positions/ExpiryCountdown";
import { formatXlm } from "@/lib/domain/format";

export default function PositionsPage() {
  const { address, connected, connect } = useWallet();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [claimable, setClaimable] = useState<ClaimablePosition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    void Promise.allSettled([
      api.getUserPositions(address).then(setPositions),
      api.getUserClaimable(address).then(setClaimable),
    ]).finally(() => setLoading(false));
  }, [address]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-lg text-white">Connect your wallet to view positions.</p>
        <button
          onClick={() => void connect()}
          className="rounded-lg bg-phase-open px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wick-border border-t-phase-open" />
      </div>
    );
  }

  const totalClaimable = claimable.reduce((sum, c) => sum + BigInt(c.claimable), 0n);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">My Positions</h1>

      {/* Claimable summary */}
      {claimable.length > 0 && (
        <div className="rounded-xl border border-up/30 bg-up-dim/20 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-up">Claimable winnings</h2>
              <p className="text-2xl font-bold text-white mt-1">
                {formatXlm(totalClaimable.toString())}
              </p>
              <p className="mt-1 text-xs text-wick-muted">
                ⚠ Unclaimed winnings expire 7 days after settlement (on-chain storage TTL).
                Funds are permanently lost after expiry.
              </p>
            </div>
            {/* Batch claim — TODO Issue #3 */}
            <ClaimButton
              roundId={claimable.map((c) => c.round_id).join(",")}
              payout={totalClaimable.toString()}
            />
          </div>

          <div className="divide-y divide-wick-border">
            {claimable.map((c) => (
              <div key={c.round_id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <span className="font-medium text-white">{c.asset}</span>
                  <span className="ml-2 text-wick-muted">{c.side === "Up" ? "▲" : "▼"}</span>
                  <span className="ml-2 text-wick-muted">{formatXlm(c.amount)} staked</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-up">{formatXlm(c.claimable)}</p>
                  {/* settled_at not on ClaimablePosition — ExpiryCountdown uses settle_ts as proxy */}
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
        {positions.length === 0 ? (
          <p className="text-center py-12 text-wick-muted">No positions yet.</p>
        ) : (
          positions.map((p) => <PositionRow key={`${p.round_id}-${p.id}`} position={p} />)
        )}
      </div>
    </div>
  );
}
