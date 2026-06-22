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

export const formatTimeRange = (g: Game) => {
  const start = new Date(g.startsAt);
  const end = new Date(start.getTime() + g.durationMins * 60_000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fmt(start)} – ${fmt(end)}`;
};

export const formatDay = (g: Game) => {
  const d = new Date(g.startsAt);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
};
