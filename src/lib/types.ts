import { APP_TIME_ZONE, dublinDateKey } from "@/lib/time";

export type Player = {
  id: string;
  name: string;
  initials: string;
  level: number;
  gamesPlayed?: number;
  isOrganiser?: boolean;
  avatarUrl?: string | null; // uploaded photo URL, if they've set one
};

export type Game = {
  id: string;
  venue: string;
  courtLabel?: string;       // e.g. "Court 2 · Outdoor panoramic"
  area?: string;             // the location/neighbourhood, e.g. "Malahide" (used for filtering)
  distanceKm?: number;       // computed client/server side from user location
  startsAt: string;          // ISO timestamp
  durationMins: number;
  levelMin: number;
  levelMax: number;
  format: "doubles" | "singles" | "open";
  maxPlayers: number;
  courtFee: number;          // total court cost in EUR
  players: Player[];
  createdBy?: string;        // user id of the game's creator (from games.created_by)
  status?: string;           // "active" (default) or "cancelled" (from games.status)
  createdAt?: string;        // ISO timestamp, from games.created_at — when this game
                              // was created (not when it's happening). Used to place a
                              // group's proposed games in the group thread by when they
                              // were proposed, not by game_time.
  pricePerPlayer?: number | null; // euro PER PLAYER (not the court total); null = not set
  isManuallyClosed?: boolean; // creator stopped new joins by hand — NOT the same as full
  recursWeekly?: boolean;    // this game repeats weekly (rolls forward after it's played)
  seriesId?: string;         // root game id of its weekly chain (the root points at itself)
};

// A game counts as cancelled only when its status is explicitly "cancelled".
// Anything else — "active", or a blank/missing status on older rows — is
// treated as a live, joinable game, so we never hide games just because the
// status column hasn't been set.
export const isCancelled = (g: Game) =>
  (g.status ?? "").trim().toLowerCase() === "cancelled";

export const pricePerHead = (g: Game) => g.courtFee / g.maxPlayers;
export const slotsLeft = (g: Game) => g.maxPlayers - g.players.length;

// ── Why a game can't be joined ───────────────────────────────────────────
// There are two DIFFERENT reasons, and they are kept deliberately separate:
//
//   isFull(g)             — every spot is taken. A fact about the roster.
//   g.isManuallyClosed    — the creator stopped new joins by hand, e.g. they
//                           filled the last spot outside the app. The roster
//                           is untouched by this: a 3-of-4 game stays 3 of 4.
//
// They are NOT collapsed into a single "closed" flag, for two reasons:
// a game can be both at once, and downstream features (the waitlist) need
// to tell them apart. Read whichever one you actually mean.
export const isFull = (g: Game) => slotsLeft(g) <= 0;


// ── Price ────────────────────────────────────────────────────────────────
// price_per_player is what ONE player pays. It is NULLABLE and null means
// "the organiser hasn't set a price" — which is NOT the same as free. Null
// must render as nothing at all: no €0.00, no "Free", no bare euro sign.
// A genuinely free game is 0, and that DOES render (as €0.00).
//
// Everything that reads a price goes through these helpers so that rule is
// enforced in one place rather than re-decided at each call site.

/* Normalise whatever came back from the database into a number or null.
   Tolerates the column being absent entirely (undefined) — exactly what
   happens on any deployment where the price migration hasn't been run yet —
   and tolerates a numeric arriving as a string, which PostgREST does for
   some numeric types. Anything that isn't a finite, non-negative number
   reads as "no price set" rather than throwing. */
export function readPrice(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* Turn what someone typed in a price box into a price we can store, or
   explain why we can't. This is the SINGLE place typed input is judged,
   so the create form and the edit form cannot drift apart.

     ""  / spaces  → { value: null }  — "no price set", a valid choice
     "12" / "12.50" → { value: 12.5 }
     "-3" / "abc" / "1.234" → { error }

   The pattern below is what blocks negatives and non-numbers: a minus
   sign simply has no way through it, and neither does a letter. */
export function parsePriceInput(raw: string): { value: number | null } | { error: string } {
  const text = raw.trim();
  if (text === "") return { value: null };

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return {
      error: "Enter a price like 12 or 12.50 — numbers only, and no minus sign.",
    };
  }

  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) {
    return { error: "Enter a price like 12 or 12.50 — numbers only, and no minus sign." };
  }
  // Matches the numeric(6,2) column: anything bigger can't be stored.
  if (n > 9999.99) {
    return { error: "That price is too high." };
  }
  return { value: n };
}

/* Format a price for display, or null when there is nothing to show. Callers
   render the result only when it isn't null, so "no price" renders nothing. */
export function formatPrice(value: number | null | undefined): string | null {
  const n = readPrice(value);
  return n == null ? null : `€${n.toFixed(2)}`;
}


// Which skill tier a game belongs to, worked out from its level band
// (Beginner 1.0–2.5, Intermediate 2.5–3.5, Advanced 3.5–5.0). Used by the
// Level filter chip.
export const skillTierOf = (g: Game): "Beginner" | "Intermediate" | "Advanced" => {
  if (g.levelMax <= 2.5) return "Beginner";
  if (g.levelMin >= 3.5) return "Advanced";
  return "Intermediate";
};

// Times render pinned to Europe/Dublin (see src/lib/time.ts) — stored values
// are true UTC instants, and every screen shows the same Dublin clock
// whatever device the viewer is on.
export const formatTimeRange = (g: Game) => {
  const start = new Date(g.startsAt);
  const end = new Date(start.getTime() + g.durationMins * 60_000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IE", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return `${fmt(start)} – ${fmt(end)}`;
};

export const formatDay = (g: Game) => {
  const d = new Date(g.startsAt);
  // "Today"/"Tomorrow" are DUBLIN calendar days — the +24h instant is only
  // used to find tomorrow's date key, so a DST-day being 23/25h wide can't
  // put the label a day out.
  const key = dublinDateKey(d);
  if (key === dublinDateKey(new Date())) return "Today";
  if (key === dublinDateKey(new Date(Date.now() + 86_400_000))) return "Tomorrow";
  return d.toLocaleDateString("en-IE", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};
