"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { openConnectModal, disconnect, getAddress } from "@/lib/stellar/wallet";

interface WalletCtx {
  address: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletCtx>({
  address: null,
  connected: false,
  connect: async () => {},
  disconnect: async () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    getAddress().then((addr) => {
      if (addr) setAddress(addr);
    });
  }, []);

  const connect = useCallback(async () => {
    await openConnectModal((addr) => setAddress(addr));
  }, []);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setAddress(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, connected: !!address, connect, disconnect: handleDisconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
