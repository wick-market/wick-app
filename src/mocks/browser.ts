/**
 * MSW browser setup. Imported lazily in MockProvider — never runs on the server.
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

export async function startMockWorker() {
  await worker.start({
    onUnhandledRequest: "bypass", // don't warn on non-API requests (Next.js internals, etc.)
    serviceWorker: {
      url: "/mockServiceWorker.js",
    },
  });
}
