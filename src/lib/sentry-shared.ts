// Shared Sentry configuration — one scrubber, used by every runtime.
//
// WHAT MUST NEVER REACH SENTRY: auth tokens, cookies, request bodies. A
// Supabase access token in a captured request header would let anyone with
// Sentry access act as that user, so this is a security control, not tidiness.
//
// The approach is allow-list, not deny-list. Everything on a request is
// dropped except the few fields that make an error diagnosable (method, and
// the URL with its query string removed), because a deny-list only protects
// against the leaks somebody already thought of.

import type { ErrorEvent, EventHint } from "@sentry/nextjs";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

/* Production only, and only when a DSN is configured. Development errors stay
   in the terminal where they belong instead of polluting the issue list. */
export const sentryEnabled =
  process.env.NODE_ENV === "production" && Boolean(SENTRY_DSN);

/* Strip a URL back to origin + path. Query strings carry the join-intent
   token today and will carry more later. */
function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  if (event.request) {
    // Rebuilt from nothing rather than edited, so a field added by a future
    // SDK version is dropped by default instead of forwarded by default.
    event.request = {
      method: event.request.method,
      url: safeUrl(event.request.url),
    };
  }

  // The user object: id only. Sentry will otherwise attach ip_address,
  // email and username when it can find them.
  if (event.user) {
    event.user = { id: event.user.id };
  }

  // Breadcrumbs can carry fetch/xhr URLs with query strings, and console
  // output with anything at all in it.
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      if (crumb.data && typeof crumb.data.url === "string") {
        return { ...crumb, data: { ...crumb.data, url: safeUrl(crumb.data.url) } };
      }
      if (crumb.category === "console") {
        // Keep that a log happened, drop what it said.
        return { ...crumb, message: undefined, data: undefined };
      }
      return crumb;
    });
  }

  return event;
}

/* Applied to every init. sendDefaultPii is false by default in the SDK; it is
   set explicitly here because the whole file depends on it. */
export const sharedSentryOptions = {
  dsn: SENTRY_DSN,
  enabled: sentryEnabled,
  sendDefaultPii: false,
  // Cookies and headers are not collected at all, on top of the scrubbing.
  maxBreadcrumbs: 20,
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
};
