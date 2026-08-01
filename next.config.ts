import type { NextConfig } from "next";

const config: NextConfig = {
  // NEXT_PUBLIC_MOCK defaults to "true" so "npm run dev" with no .env works.
  env: {
    NEXT_PUBLIC_MOCK: process.env.NEXT_PUBLIC_MOCK ?? "true",
  },
  // stellar-wallets-kit ships ESM; Next needs to transpile it.
  transpilePackages: ["@creit.tech/stellar-wallets-kit"],
};

export default config;
