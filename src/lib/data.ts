import { supabase } from "@/lib/supabaseClient";
import { dublinDateKey, dublinToUtc } from "@/lib/time";
import { isCancelled, type Game, type Player } from "./types";

/* ── Games data for the redesigned UI ───────────────────────────
   Reuses the existing Supabase client (src/lib/supabaseClient.ts), so the
   same env vars and auth setup apply — nothing here changes them.
   `rowToGame` maps OUR real `games` columns to the UI `Game` type. If the
   query fails or returns nothing, we fall back to MOCK_GAMES so the screens
   still render.                                                              */

// Our `games` table stores skill_level as text (Beginner/Intermediate/
// Advanced), but the design shows a numeric level range. Map each level to a
// sensible band so the numbers render as designed.
function levelRange(skill?: string | null): [number, number] {
  switch ((skill ?? "").trim().toLowerCase()) {
    case "beginner":
      return [1.0, 2.5];
    case "intermediate":
      return [2.5, 3.5];
    case "advanced":
      return [3.5, 5.0];
    default:
      return [2.5, 4.0];
  }
}

// A single numeric level for a player, from their text skill (band midpoint).
function skillToLevel(skill?: string | null): number {
  const [a, b] = levelRange(skill);
  return Math.round(((a + b) / 2) * 10) / 10;
}

// Our `games` table doesn't store a price, so we derive a sensible total court
// fee from the skill tier. Split across max_players this gives a realistic
// per-head price (€10 beginner / €13 intermediate / €16 advanced at 4 players).
function courtFeeFor(skill?: string | null): number {
  switch ((skill ?? "").trim().toLowerCase()) {
    case "beginner":
      return 40; // €10 / head
    case "intermediate":
      return 52; // €13 / head
    case "advanced":
      return 64; // €16 / head
    default:
      return 48; // €12 / head
  }
}

// First letters of a name → up to two initials (e.g. "Jonny K." → "JK").
function initialsFrom(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  const letters = (parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? "");
  return letters.toUpperCase() || "P";
}

// Build the real player list for a game: who is in game_players, paired with
// their profile name + skill. Falls back gracefully if names can't be read.
async function getPlayersForGame(
  gameId: string,
  createdBy?: string | null,
): Promise<Player[]> {
  const { data: rows, error } = await supabase
    .from("game_players")
    .select("user_id")
    .eq("game_id", gameId);
  if (error || !rows || rows.length === 0) return [];

  const ids = rows.map((r) => r.user_id as string);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, skill_level, avatar_url")
    .in("id", ids);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, any>();
  for (const p of profiles ?? []) byId.set(p.id as string, p);

  return ids.map((id) => {
    const p = byId.get(id);
    return {
      id,
      name: p?.name ?? "Player",
      initials: initialsFrom(p?.name),
      level: skillToLevel(p?.skill_level),
      isOrganiser: createdBy != null && id === createdBy,
      avatarUrl: p?.avatar_url ?? null,
    } satisfies Player;
  });
}

// Like getPlayersForGame, but for MANY games at once — used by the list screens
// (home and /games). It reads every game_players row for the given games in ONE
// query, looks up all those players' names/skills in ONE more, then groups them
// by game. Returns a map of game id → its players.
//
// This is the fix for "always 4 slots left": the list now knows each game's
// real joined players, so slotsLeft (maxPlayers − players.length) reflects the
// live game_players count — the exact same source the detail page uses.
async function getPlayersForGames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameRows: any[],
): Promise<Map<string, Player[]>> {
  const byGame = new Map<string, Player[]>();
  if (gameRows.length === 0) return byGame;

  const gameIds = gameRows.map((g) => String(g.id));

  // 1. Every "who is in which game" link, for all these games at once.
  const { data: links, error } = await supabase
    .from("game_players")
    .select("game_id, user_id")
    .in("game_id", gameIds);
  if (error || !links || links.length === 0) return byGame;

  // 2. One profile lookup for every player that appears (name + skill).
  const userIds = Array.from(new Set(links.map((l) => l.user_id as string)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, skill_level, avatar_url")
    .in("id", userIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileById = new Map<string, any>();
  for (const p of profiles ?? []) profileById.set(p.id as string, p);

  // Who created each game, so we can flag the organiser (same as single-game).
  const createdByGame = new Map<string, string | null>();
  for (const g of gameRows) createdByGame.set(String(g.id), g.created_by ?? null);

  // 3. Group the player links under their game.
  for (const link of links) {
    const gameId = String(link.game_id);
    const userId = link.user_id as string;
    const profile = profileById.get(userId);
    const createdBy = createdByGame.get(gameId);
    const player: Player = {
      id: userId,
      name: profile?.name ?? "Player",
      initials: initialsFrom(profile?.name),
      level: skillToLevel(profile?.skill_level),
      isOrganiser: createdBy != null && userId === createdBy,
      avatarUrl: profile?.avatar_url ?? null,
    };
    const list = byGame.get(gameId) ?? [];
    list.push(player);
    byGame.set(gameId, list);
  }
  return byGame;
}

// Maps one row of OUR `games` table (id, venue, location, game_time,
// skill_level, max_players, created_by, created_at) to the UI `Game` type.
// Fields the design shows but our schema doesn't store yet (duration, format,
// court fee, joined players) use sensible defaults — noted inline.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToGame(row: any, players: Player[] = []): Game {
  const [levelMin, levelMax] = levelRange(row.skill_level);
  return {
    id: String(row.id),
    venue: row.venue ?? "Unknown venue",
    courtLabel: row.location ?? undefined, // our "location" → the court label line
    area: row.location ?? undefined, // same location, kept separate for the Area filter
    distanceKm: undefined, // no distance/location coordinates in our schema yet
    startsAt: row.game_time, // our timestamp column
    durationMins: 90, // not stored yet — default
    levelMin,
    levelMax,
    format: "doubles", // not stored yet — default
    maxPlayers: row.max_players ?? 4,
    courtFee: courtFeeFor(row.skill_level), // derived from skill tier (no price column)
    players, // real joined players (from game_players); empty list = open slots
    createdBy: row.created_by ?? undefined, // who created the game (for owner-only actions)
    status: row.status ?? undefined, // "active" / "cancelled" (drives browse filtering + label)
    createdAt: row.created_at ?? undefined, // when the row was made (group-thread ordering)
    recursWeekly: row.recurs_weekly ?? false, // repeats weekly (rolls forward after it's played)
    seriesId: row.series_id != null ? String(row.series_id) : undefined, // weekly-chain root id
  };
}

// ── Showing only upcoming games ────────────────────────────────────────────
// This is a "find and join a game" app, so we only ever show games that
// haven't happened yet — ones starting now or later. Anything whose start time
// has already passed is hidden everywhere it's listed.

// True if this game starts now or in the future (i.e. hasn't already happened).
// `startsAt` is an ISO timestamp; comparing the two as moments in time means
// timezones don't matter here.
export function isUpcoming(game: Game): boolean {
  const start = new Date(game.startsAt).getTime();
  if (isNaN(start)) return true; // unreadable time → keep it rather than lose it
  return start >= Date.now();
}

// True if this game is happening today ON A DUBLIN CALENDAR — matching the
// "Today" label the GameCard shows (see formatDay in types.ts). Comparing
// device-local dates would move the day boundary with the viewer's timezone.
export function isToday(game: Game): boolean {
  const key = dublinDateKey(game.startsAt);
  return key !== "" && key === dublinDateKey(new Date());
}

export async function getGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .gte("game_time", new Date().toISOString()) // skip games that already happened
    .is("group_id", null) // group games are proposed inside a group's own thread
    // only — never on the public Discover list.
    .order("game_time", { ascending: true }) // soonest first
    .limit(20);
  // DEVELOPMENT ONLY: if the query failed or returned nothing, fall back to
  // the mock games so screens render while building. NEVER in production —
  // mock games look joinable but their ids don't exist in the database, so
  // every join fails on the game_players foreign key ("Couldn't take that
  // spot"). A genuinely empty board must show the real EmptyState instead.
  if (error || !data || data.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      return MOCK_GAMES
        .filter(isUpcoming)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return [];
  }

  // Load the real joined players for ALL these games in one batch, then build
  // each game WITH its players so "slots left" on every card is accurate.
  const playersByGame = await getPlayersForGames(data);
  const games = data.map((row) =>
    rowToGame(row, playersByGame.get(String(row.id)) ?? []),
  );

  // Final safety net: hide any past games AND any cancelled games (this is a
  // browse list — only live, joinable games belong here), soonest first.
  return games
    .filter((g) => isUpcoming(g) && !isCancelled(g))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export async function getGame(id: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single();
  if (!error && data) {
    const players = await getPlayersForGame(String(data.id), data.created_by);
    return rowToGame(data, players);
  }
  // DEVELOPMENT ONLY: let the mock discover cards open their mock detail
  // pages. In production an unknown game is simply not found (the page shows
  // its 404), never a fake game a visitor could try to join.
  if (process.env.NODE_ENV !== "production") {
    return MOCK_GAMES.find((g) => g.id === id) ?? null;
  }
  return null;
}

// Every game proposed inside ONE group — same UI Game shape as getGames(),
// same batched player-loading, just filtered by group_id instead of
// "upcoming and off Discover". Ordered oldest-proposed first so the group
// thread page can interleave them into the message stream by createdAt.
// No mock fallback (unlike getGames/getGame): an empty group simply has no
// proposals yet, which is a normal, real state, not a failure to paper over.
export async function getGamesForGroup(groupId: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) return [];

  const playersByGame = await getPlayersForGames(data);
  return data.map((row) =>
    rowToGame(row, playersByGame.get(String(row.id)) ?? []),
  );
}

/* ── Mock data (DEVELOPMENT ONLY — never served in production) ───────
   Used by the dev-gated fallbacks above when the games query fails or is
   empty, so screens render while building. These mirror the seed rows in
   supabase/seed.sql. Levels and per-head prices come from the skill tier
   (see levelRange / courtFeeFor above), exactly as the real rows do.       */

// Build an ISO timestamp `days` from now at the given DUBLIN time-of-day —
// the app shows game times pinned to Europe/Dublin (see src/lib/time.ts), so
// 19:30 here appears as 19:30 on screen year-round.
const inDays = (days: number, h: number, m = 0) => {
  const d = new Date(Date.now() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return dublinToUtc(dublinDateKey(d), `${pad(h)}:${pad(m)}`);
};

export const MOCK_GAMES: Game[] = [
  {
    id: "1",
    venue: "Malahide Padel Club",
    area: "Malahide",
    courtLabel: "Court 2 · Outdoor panoramic",
    distanceKm: 1.2,
    startsAt: inDays(0, 19, 30), // tonight, 7:30 pm
    durationMins: 90,
    levelMin: 2.5,
    levelMax: 3.5,
    format: "doubles",
    maxPlayers: 4,
    courtFee: 52, // Intermediate → €13 / head
    players: [
      { id: "p1", name: "Cian O'Brien", initials: "CO", level: 3.1, gamesPlayed: 38, isOrganiser: true },
      { id: "p2", name: "Aoife Walsh", initials: "AW", level: 2.9, gamesPlayed: 14 },
      { id: "p3", name: "Niamh Byrne", initials: "NB", level: 3.3, gamesPlayed: 22 },
    ],
  },
  {
    id: "2",
    venue: "Swords Padel Arena",
    area: "Swords",
    courtLabel: "Court 1 · Indoor",
    distanceKm: 4.1,
    startsAt: inDays(1, 10, 0), // tomorrow, 10:00 am
    durationMins: 90,
    levelMin: 1.0,
    levelMax: 2.5,
    format: "doubles",
    maxPlayers: 4,
    courtFee: 40, // Beginner → €10 / head
    players: [
      { id: "p4", name: "Darragh Kelly", initials: "DK", level: 2.0, gamesPlayed: 6, isOrganiser: true },
    ],
  },
  {
    id: "3",
    venue: "The Padel Yard",
    area: "Dublin City Centre",
    courtLabel: "Court 4 · Indoor premium",
    distanceKm: 14.5,
    startsAt: inDays(1, 18, 30), // tomorrow, 6:30 pm
    durationMins: 90,
    levelMin: 3.5,
    levelMax: 5.0,
    format: "doubles",
    maxPlayers: 4,
    courtFee: 64, // Advanced → €16 / head
    players: [
      { id: "p5", name: "Seán Murphy", initials: "SM", level: 4.2, gamesPlayed: 73, isOrganiser: true },
      { id: "p6", name: "Emma Doyle", initials: "ED", level: 3.8, gamesPlayed: 51 },
    ],
  },
  {
    id: "4",
    venue: "Dún Laoghaire Padel Club",
    area: "Dún Laoghaire",
    courtLabel: "Court 3 · Outdoor",
    distanceKm: 24.8,
    startsAt: inDays(2, 11, 0), // 11:00 am
    durationMins: 90,
    levelMin: 2.5,
    levelMax: 3.5,
    format: "doubles",
    maxPlayers: 4,
    courtFee: 52, // Intermediate → €13 / head
    players: [
      { id: "p7", name: "Lorcan Fitzgerald", initials: "LF", level: 3.0, gamesPlayed: 29, isOrganiser: true },
      { id: "p8", name: "Rachel Nolan", initials: "RN", level: 3.2, gamesPlayed: 18 },
    ],
  },
  {
    id: "5",
    venue: "Clontarf Padel Centre",
    area: "Clontarf",
    courtLabel: "Court 1 · Outdoor",
    distanceKm: 9.7,
    startsAt: inDays(4, 19, 0), // 7:00 pm
    durationMins: 90,
    levelMin: 1.0,
    levelMax: 2.5,
    format: "doubles",
    maxPlayers: 4,
    courtFee: 40, // Beginner → €10 / head
    players: [
      { id: "p9", name: "Mark Hughes", initials: "MH", level: 1.8, gamesPlayed: 9, isOrganiser: true },
    ],
  },
  {
    id: "6",
    venue: "Sandyford Padel Club",
    area: "Sandyford",
    courtLabel: "Court 5 · Indoor",
    distanceKm: 21.6,
    startsAt: inDays(6, 20, 0), // 8:00 pm
    durationMins: 90,
    levelMin: 3.5,
    levelMax: 5.0,
    format: "doubles",
    maxPlayers: 4,
    courtFee: 64, // Advanced → €16 / head
    players: [
      { id: "p10", name: "Conor Reilly", initials: "CR", level: 4.0, gamesPlayed: 64, isOrganiser: true },
      { id: "p11", name: "Eoin Gallagher", initials: "EG", level: 3.9, gamesPlayed: 47 },
      { id: "p12", name: "Sarah Lynch", initials: "SL", level: 3.7, gamesPlayed: 33 },
    ],
  },
];
