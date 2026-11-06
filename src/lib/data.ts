import { supabase } from "@/lib/supabaseClient";
import { dublinDateKey } from "@/lib/time";
import { isCancelled, readDuration, readPrice, type Game, type Player } from "./types";

/* ── Games data for the redesigned UI ───────────────────────────
   Reuses the existing Supabase client (src/lib/supabaseClient.ts), so the
   same env vars and auth setup apply — nothing here changes them.
   `rowToGame` maps OUR real `games` columns to the UI `Game` type. Real data
   only: a failed or empty query returns nothing, never example games.                                                              */

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
export function initialsFrom(name?: string | null): string {
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
      skill: p?.skill_level ?? null,
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
      skill: profile?.skill_level ?? null,
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
    durationMins: readDuration(row.duration_mins), // null = not set (older games)
    courtNumber: row.court_number ?? null, // null = not set (older games)
    levelMin,
    levelMax,
    format: "doubles", // not stored yet — default
    maxPlayers: row.max_players ?? 4,
    courtFee: courtFeeFor(row.skill_level), // derived from skill tier (no price column)
    players, // real joined players (from game_players); empty list = open slots
    createdBy: row.created_by ?? undefined, // who created the game (for owner-only actions)
    status: row.status ?? undefined, // "active" / "cancelled" (drives browse filtering + label)
    createdAt: row.created_at ?? undefined, // when the row was made (group-thread ordering)
    // readPrice turns a missing column (undefined, which is what comes
    // back before the price migration is run) into null, so this is safe
    // either side of the migration.
    pricePerPlayer: readPrice(row.price_per_player), // null = no price set
    // Strict === true so a missing column (undefined, before the migration
    // is run) reads as "not closed" rather than anything surprising. This
    // deliberately does NOT touch players/maxPlayers: closing a game by
    // hand never changes its count.
    isManuallyClosed: row.is_manually_closed === true,
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

// For screens that can tell "no games" apart from "couldn't load": a failed
// read throws, so it never claims there are no games when it doesn't know.
export async function loadGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .gte("game_time", new Date().toISOString()) // skip games that already happened
    .is("group_id", null) // group games are proposed inside a group's own thread
    // only — never on the public Discover list.
    .order("game_time", { ascending: true }) // soonest first
    .limit(20);
  if (error) throw error;
  if (!data || data.length === 0) return [];

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

// The same list for callers that treat a failed read as "no games".
export async function getGames(): Promise<Game[]> {
  return loadGames().catch(() => []);
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
  return null;
}

// Every game proposed inside ONE group — same UI Game shape as getGames(),
// same batched player-loading, just filtered by group_id instead of
// "upcoming and off Discover". Ordered oldest-proposed first so the group
// thread page can interleave them into the message stream by createdAt.
// An empty group simply has no proposals yet, which is a normal, real state.
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
