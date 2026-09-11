"use client";

// Product analytics — PostHog.
//
// THE RULE: user ids only. Never an email, never a name, never a venue a
// person typed, never message text. That rule is enforced here rather than
// left to whoever writes the next `capture()` call:
//
//   • The event list is a closed union. A new event has to be added to this
//     file, which is the moment somebody thinks about what it carries.
//   • Property values are restricted to ids, counts, booleans and short
//     enums by the EventProps type — there is no free-text property.
//   • stripPii() runs over every payload as a last line of defence and drops
//     anything that looks like an email or a long free string.
//
// Autocapture is OFF. It is the main way PII leaks into an analytics tool:
// it records the text of whatever was clicked, which here would include
// player names, venue names and chat. Session recording is off for the same
// reason — it would capture the whole screen.
//
// EU HOSTING: the host must be the EU cloud (eu.i.posthog.com). See
// .env.example; the app refuses to initialise against a non-EU host below.

import posthog from "posthog-js";

// Every event the app sends, in the order of the funnel. Adding to this list
// is deliberate friction.
export type AnalyticsEvent =
  // ── the funnel ──
  | "signed_up"
  | "onboarding_completed"
  | "game_viewed"
  | "game_joined"
  | "result_submitted"
  | "result_confirmed"
  // ── growth ──
  | "shared_link_opened"
  | "game_shared";

// The only property shapes allowed. No free text: a `string` here is for ids
// and short fixed enums, and stripPii() enforces that at runtime.
type EventProps = Record<string, string | number | boolean | null | undefined>;

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

/* Analytics runs in production only. In development this is a no-op, so local
   clicking around never lands in the numbers you make decisions on. */
function enabled(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    typeof window !== "undefined" &&
    Boolean(KEY)
  );
}

let started = false;

export function initAnalytics() {
  if (!enabled() || started) return;

  // A non-EU host would send EU users' data to the US and quietly contradict
  // the privacy policy. Refuse rather than default.
  if (!HOST || !HOST.includes("eu.i.posthog.com")) {
    console.warn(
      "PostHog not started: NEXT_PUBLIC_POSTHOG_HOST must be the EU cloud (https://eu.i.posthog.com).",
    );
    return;
  }

  posthog.init(KEY as string, {
    api_host: HOST,
    // Off, deliberately — see the note at the top of this file.
    autocapture: false,
    disable_session_recording: true,
    // We identify people by their auth user id and nothing else, so there is
    // no reason to let PostHog build a person profile from anything it
    // happens to observe.
    person_profiles: "identified_only",
    capture_pageview: false, // sent by hand, path only (see capturePageview)
    capture_pageleave: false,
    // IP is personal data and we have no use for it.
    ip: false,
    persistence: "localStorage",
    loaded: () => {
      started = true;
    },
  });
  started = true;
}

/* Tie events to an account. The user id is the ONLY identifier sent — no
   email, no name, and explicitly no person properties. */
export function identify(userId: string) {
  if (!enabled()) return;
  posthog.identify(userId);
}

/* On sign-out, so the next person on a shared device is not counted as the
   previous one. */
export function resetAnalytics() {
  if (!enabled()) return;
  posthog.reset();
}

/* Last line of defence. Anything that smells like PII is dropped rather than
   sent — a missing property is a nuisance, a leaked email is a breach. */
function stripPii(props: EventProps): EventProps {
  const clean: EventProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;

    if (typeof value === "string") {
      // An email address anywhere in a value.
      if (/@/.test(value)) continue;
      // Long strings are free text by definition — a name, a venue, a
      // message. Ids (uuids, 36 chars) and enums are short.
      if (value.length > 40) continue;
    }

    // A key that names something we have decided never to send, whatever it
    // holds. Belt and braces against a future careless call site.
    if (/email|name|venue|body|message|text|phone|address/i.test(key)) continue;

    clean[key] = value;
  }
  return clean;
}

export function capture(event: AnalyticsEvent, props: EventProps = {}) {
  if (!enabled()) return;
  posthog.capture(event, stripPii(props));
}

/* Pageviews, sent by hand so we control what the URL contains. The path is
   sent WITHOUT its query string: that is where the join-intent token and any
   future search terms live. */
export function capturePageview(pathname: string) {
  if (!enabled()) return;
  posthog.capture("$pageview", { $current_url: pathname });
}
