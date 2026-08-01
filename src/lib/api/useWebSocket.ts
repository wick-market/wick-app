"use client";

import { useEffect, useRef } from "react";

export type WsMessage =
  | { type: "connected" }
  | { type: "round"; data: import("@/lib/domain/round").Round }
  | { type: "price"; asset: string; price: string; ts: number };

/**
 * Subscribe to the WebSocket feed (real) or mock clock (mock mode).
 * The callback identity doesn't matter — we always use the latest via ref.
 *
 * TODO: Issue #4 — real WS reconnection with exponential backoff
 * Current real-mode implementation reconnects once on close. A production
 * implementation should use exponential backoff and surface connection state.
 */
export function useWebSocket(onMessage: (msg: WsMessage) => void): void {
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MOCK === "true") {
      // Mock mode: subscribe to the compressed-clock simulator
      let unsub: (() => void) | null = null;
      import("@/mocks/mock-clock").then(({ mockClock }) => {
        unsub = mockClock.subscribe((msg) => cbRef.current(msg as WsMessage));
      });
      return () => {
        unsub?.();
      };
    }

    // Real mode: WebSocket connection
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        cbRef.current(JSON.parse(e.data) as WsMessage);
      } catch {
        // malformed message
      }
    };

    ws.onclose = () => {
      // TODO: Issue #4 — exponential backoff reconnect
    };

    return () => ws.close();
  }, []);
}
