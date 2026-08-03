# wick-app

Frontend for [Wick](https://github.com/Tijesunimi004/wick) — a 5-minute binary
price prediction market on Stellar/Soroban testnet.

Predict whether **BTC, ETH, or SOL** will close above or below the current price
in 5 minutes. Winners split the total pot proportionally minus a 2% fee.
No AMM, no order book.

**Backend repo:** [wick-protocol](https://github.com/Tijesunimi004/wick) —
you do not need it running to contribute to this repo.

---

## You do not need the backend

Mock mode (`NEXT_PUBLIC_MOCK=true`, the default) serves all data from
`src/mocks/fixtures/`. The app runs entirely in the browser with no backend,
no Postgres, and no Rust toolchain required. A compressed-clock simulator
replays the full round lifecycle — Open → Locked → Settling → Settled — in
about 15 seconds so you can work on countdown components without waiting.

---

## Quickstart

```bash
git clone https://github.com/Tijesunimi004/wick-app.git
cd wick-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Mock mode is on by default.
No `.env` file needed.

To disable mock mode and connect to the live backend:

```bash
cp .env.example .env
# Set NEXT_PUBLIC_MOCK=false
# Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL
npm run dev
```

---

## Stack

- **Next.js 14** (App Router), TypeScript strict
- **Tailwind CSS** for styling
- **MSW 2** for mock API interception
- **@creit.tech/stellar-wallets-kit** for wallet connection
- **@stellar/stellar-sdk** for contract interaction (stubs pending)

---

## Project structure

```
src/
  app/                    Pages (Next.js App Router)
    page.tsx              Market view — 3 asset cards
    [asset]/page.tsx      Round detail — bet form + history
    positions/page.tsx    Wallet positions + claim queue
  lib/
    api/                  API client + WS hook (MSW-transparent)
    domain/               Phase state machine, payout math, formatting
    stellar/              Wallet layer + contract bindings
  mocks/
    fixtures/             Vendored from wick-protocol (do not edit)
    mock-clock.ts         30× compressed round simulator
    handlers.ts           MSW request handlers
  components/             UI components
  contexts/               WalletContext
```


## Testnet only

All XLM in this app is worthless testnet tokens.
Get free testnet XLM at [friendbot.stellar.org](https://friendbot.stellar.org).
