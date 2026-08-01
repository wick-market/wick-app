import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

// Guard: worker.start() throws if called a second time (React Strict Mode
// double-invokes effects). This flag ensures we only configure it once.
let started = false;

export async function startMockWorker() {
  if (started) return;
  started = true;

  await worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: { url: "/mockServiceWorker.js" },
  });
}
