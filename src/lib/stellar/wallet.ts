/**
 * Wallet abstraction layer.
 *
 * connect() and getAddress() are real — they open the wallet kit modal and
 * read the connected address.
 *
 * bet(), claim(), and claimMany() are typed stubs. They throw a not-implemented
 * error that the UI catches and displays as a "coming soon" message.
 *
 * TODO stubs are contributor issues. Each one needs:
 *   1. Build a Soroban transaction using the bindings in src/lib/stellar/bindings/
 *   2. Call wallet.signTransaction(tx.toXDR())
 *   3. Submit via SorobanRpc.Server.sendTransaction()
 *   4. Poll until confirmed
 * See docs/API.md in wick-protocol for the contract interface.
 */

import { TESTNET } from "./bindings/addresses";

// ── Wallet kit setup ──────────────────────────────────────────────────────────

let kitInstance: import("@creit.tech/stellar-wallets-kit").StellarWalletsKit | null = null;

async function getKit() {
  if (kitInstance) return kitInstance;
  const { StellarWalletsKit, WalletNetwork, allowAllModules } = await import(
    "@creit.tech/stellar-wallets-kit"
  );
  kitInstance = new StellarWalletsKit({
    network: WalletNetwork.TESTNET,
    selectedWalletId: "freighter",
    modules: allowAllModules(),
  });
  return kitInstance;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface WalletState {
  address: string | null;
  connected: boolean;
}

export async function openConnectModal(
  onConnect: (address: string) => void
): Promise<void> {
  const kit = await getKit();
  await kit.openModal({
    onWalletSelected: async (option) => {
      kit.setWallet(option.id);
      const { address } = await kit.getAddress();
      onConnect(address);
    },
  });
}

export async function disconnect(): Promise<void> {
  kitInstance = null;
}

export async function getAddress(): Promise<string | null> {
  try {
    const kit = await getKit();
    const { address } = await kit.getAddress();
    return address;
  } catch {
    return null;
  }
}

// ── Transaction stubs ─────────────────────────────────────────────────────────

export class NotImplementedError extends Error {
  constructor(fn: string) {
    super(`${fn} is not yet implemented. See CONTRIBUTING.md for how to claim this issue.`);
    this.name = "NotImplementedError";
  }
}

/**
 * Place a bet on a round.
 *
 * TODO: Issue #1 — sign and submit bet transaction
 * Needs:
 *   - Build tx: Client.bet({ user, round_id, side, amount }) from bindings
 *   - wallet.signTransaction(tx.toXDR(), { networkPassphrase: TESTNET.NETWORK_PASSPHRASE })
 *   - SorobanRpc.Server.sendTransaction(signedTx)
 *   - Poll SorobanRpc.Server.getTransaction(hash) until SUCCESS or FAILED
 */
export async function bet(
  _roundId: string,
  _side: "Up" | "Down",
  _amountStroops: bigint
): Promise<void> {
  throw new NotImplementedError("bet()");
}

/**
 * Claim a single round's winnings.
 *
 * TODO: Issue #2 — sign and submit claim transaction
 * Needs: Client.claim({ user, round_id }) from bindings
 */
export async function claim(_roundId: string): Promise<void> {
  throw new NotImplementedError("claim()");
}

/**
 * Batch claim up to 20 rounds in a single transaction.
 *
 * TODO: Issue #3 — sign and submit claim_many transaction
 * Needs: Client.claim_many({ user, round_ids }) from bindings
 * Note: capped at 20 by the contract (ClaimBatchTooLarge error if exceeded)
 */
export async function claimMany(_roundIds: string[]): Promise<void> {
  throw new NotImplementedError("claimMany()");
}

export const CONTRACT_ID = TESTNET.FAIR_MARKET;
export const RPC_URL = TESTNET.RPC_URL;
export const NETWORK_PASSPHRASE = TESTNET.NETWORK_PASSPHRASE;
