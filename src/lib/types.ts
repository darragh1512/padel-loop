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
