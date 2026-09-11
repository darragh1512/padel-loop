"use client";

// "I tapped Join, then had to make an account." This carries that intent
// across the sign-up detour so the person lands back on THE GAME with the join
// still waiting to happen — not on the home screen, wondering what became of
// the link their mate sent them.
//
// TWO CARRIERS, because there are two different journeys:
//
//   1. The URL (?next=/games/123&intent=join) is the primary one. It survives
//      a refresh, a back button, being opened in a new tab, and the hop from
//      the login page to the sign-up page. It is inspectable, it expires
//      naturally by being gone, and it needs no storage permission.
//
//   2. localStorage is the backup, and it exists for exactly one case: sign-up
//      that requires email confirmation. There the person LEAVES the site,
//      clicks a link in their email, and comes back cold — possibly in a
//      different tab, with no query string left. The URL cannot survive that;
//      a stored note can.
//
// The URL wins when both are present, because it describes the journey the
// person is actually on right now.

const KEY = "padel-loop:pending-join";

// A stored intent older than this is ignored. Someone who started signing up
// yesterday and finally confirmed their email should land on the game, not be
// silently joined to it — the game may be over.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type StoredIntent = { gameId: string; at: number };

/* Build the sign-in URL that carries the intent, and leave the backup note.
   Returns the path to push. */
export function startAuthForJoin(gameId: string): string {
  const next = `/games/${gameId}`;
  try {
    const note: StoredIntent = { gameId, at: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(note));
  } catch {
    // Private browsing, or storage blocked. The URL still carries it, which
    // covers every path except the email round trip.
  }
  return `/login?next=${encodeURIComponent(next)}&intent=join`;
}

/* Where to send someone after they authenticate. Falls back to home. Only
   same-site paths are honoured: `next` arrives from a query string, so an
   absolute URL there would be an open redirect straight off our login page. */
export function safeNextPath(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

/* The auth pages need `next` and `intent` only inside their submit
   handler, which already runs in the browser. Reading window.location
   directly avoids useSearchParams, which would force those statically
   rendered pages behind a Suspense boundary for the sake of two values
   used in one event handler. */
export function readAuthParams(): { next: string; intent: string | null } {
  try {
    const q = new URLSearchParams(window.location.search);
    return { next: safeNextPath(q.get("next")), intent: q.get("intent") };
  } catch {
    return { next: "/", intent: null };
  }
}

/* Is there a join waiting for this game? Checks the URL first, then the
   stored note. Reading does not clear it — the caller clears once it has
   actually acted, so a failed attempt isn't silently lost. */
export function hasPendingJoin(gameId: string, intentParam: string | null): boolean {
  if (intentParam === "join") return true;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return false;
    const note = JSON.parse(raw) as StoredIntent;
    if (note.gameId !== gameId) return false;
    if (!Number.isFinite(note.at) || Date.now() - note.at > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/* Done with it — successfully or not. Always called once the intent has been
   acted on, so it can't fire twice. */
export function clearPendingJoin() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do; the URL copy is stripped separately by the caller.
  }
}
