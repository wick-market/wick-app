"use client";

import { useEffect } from "react";

/**
 * Initialises MSW in the browser when NEXT_PUBLIC_MOCK=true.
 * Imported in the root layout so it runs before any data fetching.
 */
export function MockProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MOCK === "true") {
      import("@/mocks/browser").then(({ startMockWorker }) => startMockWorker());
    }
  }, []);

  return <>{children}</>;
}
