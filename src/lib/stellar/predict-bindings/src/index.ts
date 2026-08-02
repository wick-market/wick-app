import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CBJDHRRZ7G62S5ZGDEM53CIHRS3OMKCGOHM27I5XYBD2ANNVNIAJHTX2",
  }
} as const

export type Side = {tag: "Above", values: void} | {tag: "Below", values: void};

export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"RoundNotFound"},
  4: {message:"RoundLocked"},
  5: {message:"RoundNotSettled"},
  6: {message:"AlreadySettled"},
  7: {message:"TooEarly"},
  8: {message:"BetTooSmall"},
  9: {message:"AlreadyBet"},
  10: {message:"NothingToClaim"},
  11: {message:"FeeTooHigh"},
  12: {message:"LockOffsetTooSmall"},
  13: {message:"Unauthorized"},
  14: {message:"DuplicateRound"},
  15: {message:"OracleNoPrice"}
}


export interface Round {
  /**
 * Sum of (amount × time_remaining) for all Above bettors.
 */
boosted_above: i128;
  /**
 * Sum of (amount × time_remaining) for all Below bettors.
 */
boosted_below: i128;
  /**
 * boosted_above + boosted_below — global denominator for loser refunds.
 */
global_boosted: i128;
  id: u64;
  lock_ts: u64;
  outcome: Outcome;
  /**
 * Total XLM staked on Above (stroops).
 */
pool_above: i128;
  /**
 * Total XLM staked on Below (stroops).
 */
pool_below: i128;
  /**
 * Settlement price from oracle. Zero until settled.
 */
settle_price: i128;
  settle_ts: u64;
  status: Status;
  /**
 * XLM/USD oracle price at open — the reference to predict against.
 */
strike: i128;
  strike_ts: u64;
}


export interface Config {
  admin: string;
  fee_bps: u32;
  lock_offset: u64;
  min_bet: i128;
  oracle: string;
  oracle_decimals: u32;
  /**
 * Seconds between oracle updates. Reflector=300, test oracle=60.
 */
oracle_interval: u64;
  token: string;
}

export type Status = {tag: "Open", values: void} | {tag: "Locked", values: void} | {tag: "Settled", values: void};

export type Outcome = {tag: "Above", values: void} | {tag: "Below", values: void} | {tag: "Void", values: void};


export interface Position {
  /**
 * Stroops staked.
 */
amount: i128;
  /**
 * Time-weighted shares: amount × (lock_ts − bet_ts).
 * Larger for early bettors — determines Ninetails bonus share.
 */
boosted: i128;
  claimed: boolean;
  round_id: u64;
  side: Side;
}


export interface PriceData {
  price: i128;
  timestamp: u64;
}

export type OracleAsset = {tag: "Stellar", values: readonly [string]} | {tag: "Other", values: readonly [string]};

export interface Client {
  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim: ({user, round_id}: {user: string, round_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a settle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  settle: ({round_id}: {round_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a bet_above transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bet_above: ({user, round_id, amount}: {user: string, round_id: u64, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a bet_below transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  bet_below: ({user, round_id, amount}: {user: string, round_id: u64, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_round transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_round: ({round_id}: {round_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Round>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin, oracle, token, fee_bps, min_bet, lock_offset, oracle_interval}: {admin: string, oracle: string, token: string, fee_bps: u32, min_bet: i128, lock_offset: u64, oracle_interval: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a sweep_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  sweep_fees: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_fee_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_fee_bps: ({bps}: {bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_round transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_round: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a get_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_position: ({round_id, user}: {round_id: u64, user: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Position>>>

  /**
   * Construct and simulate a set_lock_offset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_lock_offset: ({seconds}: {seconds: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a current_round_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  current_round_id: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAABFNpZGUAAAACAAAAAAAAAAAAAAAFQWJvdmUAAAAAAAAAAAAAAAAAAAVCZWxvdwAAAA==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADwAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAANUm91bmROb3RGb3VuZAAAAAAAAAMAAAAAAAAAC1JvdW5kTG9ja2VkAAAAAAQAAAAAAAAAD1JvdW5kTm90U2V0dGxlZAAAAAAFAAAAAAAAAA5BbHJlYWR5U2V0dGxlZAAAAAAABgAAAAAAAAAIVG9vRWFybHkAAAAHAAAAAAAAAAtCZXRUb29TbWFsbAAAAAAIAAAAAAAAAApBbHJlYWR5QmV0AAAAAAAJAAAAAAAAAA5Ob3RoaW5nVG9DbGFpbQAAAAAACgAAAAAAAAAKRmVlVG9vSGlnaAAAAAAACwAAAAAAAAASTG9ja09mZnNldFRvb1NtYWxsAAAAAAAMAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAANAAAAAAAAAA5EdXBsaWNhdGVSb3VuZAAAAAAADgAAAAAAAAANT3JhY2xlTm9QcmljZQAAAAAAAA8=",
        "AAAAAQAAAAAAAAAAAAAABVJvdW5kAAAAAAAADQAAADhTdW0gb2YgKGFtb3VudCDDlyB0aW1lX3JlbWFpbmluZykgZm9yIGFsbCBBYm92ZSBiZXR0b3JzLgAAAA1ib29zdGVkX2Fib3ZlAAAAAAAACwAAADhTdW0gb2YgKGFtb3VudCDDlyB0aW1lX3JlbWFpbmluZykgZm9yIGFsbCBCZWxvdyBiZXR0b3JzLgAAAA1ib29zdGVkX2JlbG93AAAAAAAACwAAAEdib29zdGVkX2Fib3ZlICsgYm9vc3RlZF9iZWxvdyDigJQgZ2xvYmFsIGRlbm9taW5hdG9yIGZvciBsb3NlciByZWZ1bmRzLgAAAAAOZ2xvYmFsX2Jvb3N0ZWQAAAAAAAsAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAAdsb2NrX3RzAAAAAAYAAAAAAAAAB291dGNvbWUAAAAH0AAAAAdPdXRjb21lAAAAACRUb3RhbCBYTE0gc3Rha2VkIG9uIEFib3ZlIChzdHJvb3BzKS4AAAAKcG9vbF9hYm92ZQAAAAAACwAAACRUb3RhbCBYTE0gc3Rha2VkIG9uIEJlbG93IChzdHJvb3BzKS4AAAAKcG9vbF9iZWxvdwAAAAAACwAAADFTZXR0bGVtZW50IHByaWNlIGZyb20gb3JhY2xlLiBaZXJvIHVudGlsIHNldHRsZWQuAAAAAAAADHNldHRsZV9wcmljZQAAAAsAAAAAAAAACXNldHRsZV90cwAAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAZTdGF0dXMAAAAAAEJYTE0vVVNEIG9yYWNsZSBwcmljZSBhdCBvcGVuIOKAlCB0aGUgcmVmZXJlbmNlIHRvIHByZWRpY3QgYWdhaW5zdC4AAAAAAAZzdHJpa2UAAAAAAAsAAAAAAAAACXN0cmlrZV90cwAAAAAAAAY=",
        "AAAAAQAAAAAAAAAAAAAABkNvbmZpZwAAAAAACAAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAC2xvY2tfb2Zmc2V0AAAAAAYAAAAAAAAAB21pbl9iZXQAAAAACwAAAAAAAAAGb3JhY2xlAAAAAAATAAAAAAAAAA9vcmFjbGVfZGVjaW1hbHMAAAAABAAAAD5TZWNvbmRzIGJldHdlZW4gb3JhY2xlIHVwZGF0ZXMuIFJlZmxlY3Rvcj0zMDAsIHRlc3Qgb3JhY2xlPTYwLgAAAAAAD29yYWNsZV9pbnRlcnZhbAAAAAAGAAAAAAAAAAV0b2tlbgAAAAAAABM=",
        "AAAAAgAAAAAAAAAAAAAABlN0YXR1cwAAAAAAAwAAAAAAAAAAAAAABE9wZW4AAAAAAAAAAAAAAAZMb2NrZWQAAAAAAAAAAAAAAAAAB1NldHRsZWQA",
        "AAAAAgAAAAAAAAAAAAAAB091dGNvbWUAAAAAAwAAAAAAAAAAAAAABUFib3ZlAAAAAAAAAAAAAAAAAAAFQmVsb3cAAAAAAAAAAAAAAAAAAARWb2lk",
        "AAAAAQAAAAAAAAAAAAAACFBvc2l0aW9uAAAABQAAAA9TdHJvb3BzIHN0YWtlZC4AAAAABmFtb3VudAAAAAAACwAAAHRUaW1lLXdlaWdodGVkIHNoYXJlczogYW1vdW50IMOXIChsb2NrX3RzIOKIkiBiZXRfdHMpLgpMYXJnZXIgZm9yIGVhcmx5IGJldHRvcnMg4oCUIGRldGVybWluZXMgTmluZXRhaWxzIGJvbnVzIHNoYXJlLgAAAAdib29zdGVkAAAAAAsAAAAAAAAAB2NsYWltZWQAAAAAAQAAAAAAAAAIcm91bmRfaWQAAAAGAAAAAAAAAARzaWRlAAAH0AAAAARTaWRl",
        "AAAAAQAAAAAAAAAAAAAACVByaWNlRGF0YQAAAAAAAAIAAAAAAAAABXByaWNlAAAAAAAACwAAAAAAAAAJdGltZXN0YW1wAAAAAAAABg==",
        "AAAAAAAAAAAAAAAFY2xhaW0AAAAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAIcm91bmRfaWQAAAAGAAAAAQAAAAs=",
        "AAAAAgAAAAAAAAAAAAAAC09yYWNsZUFzc2V0AAAAAAIAAAABAAAAAAAAAAdTdGVsbGFyAAAAAAEAAAATAAAAAQAAAAAAAAAFT3RoZXIAAAAAAAABAAAAEQ==",
        "AAAAAAAAAAAAAAAGc2V0dGxlAAAAAAABAAAAAAAAAAhyb3VuZF9pZAAAAAYAAAAA",
        "AAAAAAAAAAAAAAAJYmV0X2Fib3ZlAAAAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAACHJvdW5kX2lkAAAABgAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAAJYmV0X2JlbG93AAAAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAACHJvdW5kX2lkAAAABgAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAAJZ2V0X3JvdW5kAAAAAAAAAQAAAAAAAAAIcm91bmRfaWQAAAAGAAAAAQAAB9AAAAAFUm91bmQAAAA=",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAABkNvbmZpZwAA",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAABwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAZvcmFjbGUAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAHZmVlX2JwcwAAAAAEAAAAAAAAAAdtaW5fYmV0AAAAAAsAAAAAAAAAC2xvY2tfb2Zmc2V0AAAAAAYAAAAAAAAAD29yYWNsZV9pbnRlcnZhbAAAAAAGAAAAAA==",
        "AAAAAAAAAAAAAAAKc3dlZXBfZmVlcwAAAAAAAAAAAAA=",
        "AAAAAAAAAAAAAAALc2V0X2ZlZV9icHMAAAAAAQAAAAAAAAADYnBzAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAAMY3JlYXRlX3JvdW5kAAAAAAAAAAEAAAAG",
        "AAAAAAAAAAAAAAAMZ2V0X3Bvc2l0aW9uAAAAAgAAAAAAAAAIcm91bmRfaWQAAAAGAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPoAAAH0AAAAAhQb3NpdGlvbg==",
        "AAAAAAAAAAAAAAAPc2V0X2xvY2tfb2Zmc2V0AAAAAAEAAAAAAAAAB3NlY29uZHMAAAAABgAAAAA=",
        "AAAAAAAAAAAAAAAQY3VycmVudF9yb3VuZF9pZAAAAAAAAAABAAAABg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    claim: this.txFromJSON<i128>,
        settle: this.txFromJSON<null>,
        bet_above: this.txFromJSON<null>,
        bet_below: this.txFromJSON<null>,
        get_round: this.txFromJSON<Round>,
        get_config: this.txFromJSON<Config>,
        initialize: this.txFromJSON<null>,
        sweep_fees: this.txFromJSON<null>,
        set_fee_bps: this.txFromJSON<null>,
        create_round: this.txFromJSON<u64>,
        get_position: this.txFromJSON<Option<Position>>,
        set_lock_offset: this.txFromJSON<null>,
        current_round_id: this.txFromJSON<u64>
  }
}