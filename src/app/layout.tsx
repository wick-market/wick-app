import type { Metadata } from "next";
import "./globals.css";
import { TestnetBanner } from "@/components/layout/TestnetBanner";
import { Header } from "@/components/layout/Header";
import { MockProvider } from "@/components/providers/MockProvider";
import { WalletProvider } from "@/contexts/WalletContext";

export const metadata: Metadata = {
  title: "Wick — 5-minute price prediction on Stellar",
  description:
    "Predict whether BTC, ETH, or SOL will close above or below the current price in 5 minutes. Parimutuel payouts. Testnet only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-wick-bg text-white">
        <WalletProvider>
          {/* MockProvider registers MSW in the browser when NEXT_PUBLIC_MOCK=true */}
          <MockProvider>
            <TestnetBanner />
            <Header />
            <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
          </MockProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
