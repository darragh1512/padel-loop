// Client-side instrumentation: Sentry in the browser, plus PostHog start-up.
// Next runs this before the app becomes interactive (see the
// instrumentation-client file convention).

import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/sentry-shared";
import { initAnalytics } from "@/lib/analytics";

// Wrapped so a failure in one tool cannot stop the other — or the app.
try {
  Sentry.init({
    ...sharedSentryOptions,
    // Browser-side replay is deliberately NOT enabled: it records the screen,
    // which here means player names, chat and email fields.
    integrations: [],
  });
} catch (err) {
  console.error("Sentry (client) failed to start:", err);
}

try {
  initAnalytics();
} catch (err) {
  console.error("PostHog failed to start:", err);
}

// Lets Sentry tie an error to the navigation that caused it.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// The service worker. Registered here rather than in a component so it
// happens once per page load, not once per mount.
//
// Production only: in development it would cache dev-server assets and serve
// them back after an edit, which looks exactly like your changes not saving.
if (
  process.env.NODE_ENV === "production" &&
  typeof window !== "undefined" &&
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Never fatal — the app works fine without it; it only loses the
      // asset cache and Chrome’s install prompt.
      console.error("Service worker registration failed:", err);
    });
  });
}
