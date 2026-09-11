// Server-side instrumentation. Runs once per runtime on boot.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  const { sharedSentryOptions } = await import("@/lib/sentry-shared");

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(sharedSentryOptions);
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sharedSentryOptions);
  }
}

// Server errors Next catches (Server Components, route handlers) reach Sentry
// through here. The same beforeSend scrubber applies, so request bodies and
// headers are stripped before anything leaves the process.
export const onRequestError = Sentry.captureRequestError;
