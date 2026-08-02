import type { Metadata } from "next";
import "./globals.css";
import { MockProvider } from "@/components/providers/MockProvider";

export const metadata: Metadata = {
  title: "Wick — XLM Price Prediction",
  description: "Predict whether XLM closes above or below the current price in 5 minutes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-white antialiased">
        <MockProvider>{children}</MockProvider>
      </body>
    </html>
  );
}
