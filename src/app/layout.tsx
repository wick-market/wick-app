import type { Metadata } from "next";
import "./globals.css";
import { MockProvider } from "@/components/providers/MockProvider";

export const metadata: Metadata = {
  title: "Wick — XLM Price Prediction on Stellar",
  description:
    "Predict whether XLM closes above or below the current price in 5 minutes. Parimutuel payouts on Stellar testnet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-white antialiased">
        <MockProvider>
          <main className="mx-auto max-w-2xl px-4 py-10">{children}</main>
        </MockProvider>
      </body>
    </html>
  );
}
