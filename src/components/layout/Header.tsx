"use client";

import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";

function shortAddress(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function Header() {
  const { address, connected, connect, disconnect } = useWallet();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-wick-border bg-wick-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo + nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">
            Wick
            <span className="ml-1.5 rounded bg-phase-open/20 px-1.5 py-0.5 text-xs font-normal text-phase-open">
              testnet
            </span>
          </Link>
          <nav className="hidden gap-4 text-sm text-wick-muted sm:flex">
            <Link href="/" className="hover:text-white transition-colors">
              Markets
            </Link>
            <Link href="/positions" className="hover:text-white transition-colors">
              Positions
            </Link>
          </nav>
        </div>

        {/* Wallet */}
        {connected && address ? (
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-wick-border bg-wick-bg px-3 py-1.5 font-mono text-sm text-white">
              {shortAddress(address)}
            </span>
            <button
              onClick={() => void disconnect()}
              className="rounded border border-wick-border px-3 py-1.5 text-sm text-wick-muted transition-colors hover:border-white/30 hover:text-white"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => void connect()}
            className="rounded bg-phase-open px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
