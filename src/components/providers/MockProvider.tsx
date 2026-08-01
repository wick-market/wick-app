"use client";

import { useEffect, useState } from "react";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

/**
 * Blocks rendering until MSW is ready to intercept fetches.
 * Without this, page components fire their useEffect fetches before the
 * service worker is registered, producing "Failed to fetch" errors.
 *
 * In real mode (NEXT_PUBLIC_MOCK=false) this is a transparent pass-through.
 */
export function MockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!IS_MOCK);

  useEffect(() => {
    if (!IS_MOCK) return;
    import("@/mocks/browser")
      .then(({ startMockWorker }) => startMockWorker())
      .then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wick-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wick-border border-t-phase-open" />
      </div>
    );
  }

  return <>{children}</>;
}
