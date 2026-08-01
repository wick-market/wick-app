"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { openConnectModal, disconnect, getAddress, getXlmBalance } from "@/lib/stellar/wallet";

interface WalletCtx {
  address: string | null;
  connected: boolean;
  xlmBalance: string | null; // e.g. "9994.14"
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletCtx>({
  address: null,
  connected: false,
  xlmBalance: null,
  connect: async () => {},
  disconnect: async () => {},
  refreshBalance: async () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);

  const fetchBalance = useCallback(async (addr: string) => {
    const bal = await getXlmBalance(addr);
    setXlmBalance(bal);
  }, []);

  // Restore session on mount
  useEffect(() => {
    getAddress().then((addr) => {
      if (addr) {
        setAddress(addr);
        void fetchBalance(addr);
      }
    });
  }, [fetchBalance]);

  // Refresh balance every 30 seconds when connected
  useEffect(() => {
    if (!address) return;
    const id = setInterval(() => void fetchBalance(address), 30_000);
    return () => clearInterval(id);
  }, [address, fetchBalance]);

  const connect = useCallback(async () => {
    await openConnectModal((addr) => {
      setAddress(addr);
      void fetchBalance(addr);
    });
  }, [fetchBalance]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setAddress(null);
    setXlmBalance(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (address) await fetchBalance(address);
  }, [address, fetchBalance]);

  return (
    <WalletContext.Provider
      value={{
        address,
        connected: !!address,
        xlmBalance,
        connect,
        disconnect: handleDisconnect,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
