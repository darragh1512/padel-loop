// This file reads REAL games from your Supabase "games" table, and now also
// handles WHO has joined each game via the separate "game_players" table.
//
// Important change: we no longer use the old "current_players" number column.
// The count of players is now worked out from the game_players table, where
// each row links one user to one game.

import { supabase } from "@/lib/supabaseClient";
import { DataError } from "@/lib/loadable";
import { APP_TIME_ZONE } from "@/lib/time";
import { getGroupConversationsFor, type Group } from "./groups";

// The shape of one game — these names match the columns in your Supabase
// "games" table.
export type Game = {
  id: string; // unique label for the game (used in the web address)
  venue: string; // name of the padel club / court
  location: string; // where it is (neighbourhood / town)
  game_time: string; // when the game is happening
  skill_level: string; // the skill level the game is aimed at
  max_players: number; // total spots in the game
  created_by: string | null; // the user id of whoever created the game
  status?: string | null; // "active" (default) or "cancelled"
  price_per_player?: number | string | null; // euro PER PLAYER; null/absent = not set
  is_manually_closed?: boolean | null; // creator stopped new joins by hand
};

// Turns a stored timestamp (e.g. "2026-06-10T17:30:00+00:00") into friendly
// text like "Wed 10 Jun, 18:30". If the value isn't a date we understand,
// we just show it unchanged so nothing breaks.
// Europe/Dublin, 24h — the SAME policy as formatTimeRange/formatDay in
// src/lib/types.ts. Times are stored as true UTC instants and always
// PRESENTED on a Dublin clock (see src/lib/time.ts), whatever device the
// viewer is on. One game must never show two different clocks.
export function formatGameTime(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// Fetch ALL games from the database, earliest game_time first.
export async function getGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games") // the table name
    .select("*") // every column
    .order("game_time", { ascending: true }); // sort by when the game is

  // If something went wrong, log it and return an empty list so the page
  // still loads instead of crashing.
  if (error) {
    console.error("Could not load games:", error.message);
    return [];
  }

  return data ?? [];
}

// Fetch ONE game by its id. Returns the game, or null if it isn't found.
export async function getGame(id: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id) // "where id equals this id"
    .single(); // expect exactly one matching row

  if (error) {
    console.error("Could not load game:", error.message);
    return null;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Players — everything below works with the "game_players" table, where each
// row links one user (user_id) to one game (game_id).
// ---------------------------------------------------------------------------

// Count how many players are in EACH of the given games. Returns an object
// like { "3": 2, "5": 4 } mapping a game's id to its number of players.
// Used by the home list, which needs counts for many games at once.
export async function getPlayerCounts(
  gameIds: string[],
): Promise<Record<string, number>> {
  if (gameIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("game_players")
    .select("game_id")
    .in("game_id", gameIds); // only the games we're showing

  if (error) {
    console.error("Could not count players:", error.message);
    return {};
  }

  // Tally up how many rows each game has.
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = String(row.game_id);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// Get the user ids of everyone in ONE game. The detail screen uses this both
// to count spots left and to check whether YOU are already in the game.
export async function getGamePlayers(gameId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("game_players")
    .select("user_id")
    .eq("game_id", gameId);

  if (error) {
    console.error("Could not load players:", error.message);
    return [];
  }

  return (data ?? []).map((row) => row.user_id as string);
}

// Get all games the logged-in user has JOINED. We do this in two steps:
//   1. Find their rows in "game_players" to get the ids of games they're in.
//   2. Fetch those games from the "games" table.
// Returns the games sorted by game_time (earliest first), or an empty list.
export async function getGamesJoinedBy(userId: string): Promise<Game[]> {
  // 1. Which games is this person in.
  const { data: rows, error } = await supabase
    .from("game_players")
    .select("game_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Could not load joined games:", error.message);
    return [];
  }

  const gameIds = (rows ?? []).map((row) => row.game_id as string);
  if (gameIds.length === 0) {
    return [];
  }

  // 2. Fetch those games.
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("*")
    .in("id", gameIds)
    .order("game_time", { ascending: true });

  if (gamesError) {
    console.error("Could not load joined games:", gamesError.message);
    return [];
  }

  return games ?? [];
}

// Get the UPCOMING games a given user is in — i.e. games they've joined whose
// time is still in the future. Same two-step join as getGamesJoinedBy (read
// their rows in game_players, then fetch those games), but the games query
// only keeps rows with a game_time from now onwards. Cancelled games are left
// out so the list shows games actually worth turning up to. Sorted soonest
// first. Used by the public player profile page.
export async function getUpcomingGamesFor(userId: string): Promise<Game[]> {
  // 1. Which games is this person in.
  const { data: rows, error } = await supabase
    .from("game_players")
    .select("game_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Could not load joined games:", error.message);
    // Throws instead of returning [] so the home screen can tell this apart
    // from "you have no games" — see src/lib/loadable.ts.
    throw new DataError("Could not load joined games", error.message);
  }

  const gameIds = (rows ?? []).map((row) => row.game_id as string);
  if (gameIds.length === 0) {
    return [];
  }

  // 2. Fetch those games, future only (game_time >= now), soonest first.
  const nowIso = new Date().toISOString();
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("*")
    .in("id", gameIds)
    .gte("game_time", nowIso)
    .order("game_time", { ascending: true });

  if (gamesError) {
    console.error("Could not load upcoming games:", gamesError.message);
    return [];
  }

  // Drop cancelled games (status literally "cancelled"); blank/missing status
  // on older rows still counts as a live game.
  return (games ?? []).filter(
    (g) => (g.status ?? "").trim().toLowerCase() !== "cancelled",
  );
}

// The ids of every game the user is already in — games they've JOINED (a row in
// game_players) or CREATED (their id in created_by). The discovery list uses
// this to hide games the user can't join again, so it only shows genuinely
// joinable games. Games they were REMOVED from are included too — they can't
// rejoin those. Returns a de-duplicated list of ids as strings.
export async function getJoinedOrCreatedGameIds(
  userId: string,
): Promise<string[]> {
  const [joined, created, removed] = await Promise.all([
    supabase.from("game_players").select("game_id").eq("user_id", userId),
    supabase.from("games").select("id").eq("created_by", userId),
    supabase.from("game_removals").select("game_id").eq("user_id", userId),
  ]);

  if (joined.error) {
    console.error("Could not load joined games:", joined.error.message);
  }
  if (created.error) {
    console.error("Could not load created games:", created.error.message);
  }

  const ids = new Set<string>();
  for (const row of joined.data ?? []) ids.add(String(row.game_id));
  for (const row of created.data ?? []) ids.add(String(row.id));
  // No error log here: before the removals migration runs the table is
  // missing, and "removed from nothing" is the right answer.
  for (const row of removed.data ?? []) ids.add(String(row.game_id));
  return Array.from(ids);
}

// Get all games the logged-in user CREATED (their id is in created_by).
// Returns the games sorted by game_time (earliest first), or an empty list.
export async function getGamesCreatedBy(userId: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("created_by", userId)
    .order("game_time", { ascending: true });

  if (error) {
    console.error("Could not load created games:", error.message);
    return [];
  }

  return data ?? [];
}

// One player in a game, paired with their profile name (if they have one yet).
export type GamePlayer = {
  user_id: string;
  name: string | null; // their profile name, or null if they haven't set one
};

// Get everyone in ONE game together with their name. We do this in two steps:
//   1. Read the user ids in this game from "game_players".
//   2. Look those ids up in "profiles" to get each person's name.
// (We join the two tables ourselves on user_id = profiles.id rather than
// relying on a database relationship, so it works no matter how the tables are
// linked.) The returned order matches the join order from game_players.
export async function getGamePlayerProfiles(
  gameId: string,
): Promise<GamePlayer[]> {
  // 1. Who is in this game.
  const { data: rows, error } = await supabase
    .from("game_players")
    .select("user_id")
    .eq("game_id", gameId);

  if (error) {
    console.error("Could not load players:", error.message);
    return [];
  }

  const userIds = (rows ?? []).map((row) => row.user_id as string);
  if (userIds.length === 0) {
    return [];
  }

  // 2. Their names, looked up by matching profiles.id to those user ids.
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", userIds);

  if (profileError) {
    // If names can't be read, still return the players (names just come back
    // as null and the screen falls back to a placeholder).
    console.error("Could not load player names:", profileError.message);
    return userIds.map((id) => ({ user_id: id, name: null }));
  }

  // Build a quick lookup of id -> name, then pair it back to each player.
  const nameById = new Map<string, string | null>();
  for (const profile of profiles ?? []) {
    nameById.set(profile.id as string, (profile.name as string | null) ?? null);
  }

  return userIds.map((id) => ({
    user_id: id,
    name: nameById.get(id) ?? null,
  }));
}

// Add the logged-in user to a game (they tapped "Join"). Returns { ok: true }
// on success, or { error } with a message if something went wrong.
export async function joinGame(
  gameId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("game_players")
    .insert({ game_id: gameId, user_id: userId });

  if (error) {
    console.error("Could not join game:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// Remove the logged-in user from a game (they tapped "Leave").
// Two situations where leaving is refused. Both are checked here so the
// person gets a sentence explaining why rather than a failed delete, but
// NEITHER is a security boundary — these are client-side checks that a
// direct API call would skip. The database-side versions live in the
// player-leaves migration (see MIGRATIONS_PENDING.md).
export const LEAVE_REFUSED_CREATOR =
  "You created this game, so you can't leave it — cancel the game instead.";
export const LEAVE_REFUSED_RESULT =
  "This game already has a match result, so its players are fixed.";

export async function leaveGame(
  gameId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  // 1. The organiser can't walk away from their own game. Leaving would
  //    strand a game that still has their name on it: they would keep Edit,
  //    Cancel and chat access (both are keyed off created_by) while quietly
  //    vanishing from the roster. Cancelling is the honest action.
  const { data: game } = await supabase
    .from("games")
    .select("created_by")
    .eq("id", gameId)
    .maybeSingle();

  if (game && game.created_by === userId) {
    return { error: LEAVE_REFUSED_CREATOR };
  }

  // 2. Once a match result exists the four players are part of the record.
  //    Leaving does NOT remove them from match_result_participants, and the
  //    consensus check counts that table — so a departed player is still
  //    required to submit a scoresheet, and the result would sit unfinalised
  //    forever waiting for someone who has gone.
  const { data: result } = await supabase
    .from("match_results")
    .select("id")
    .eq("game_id", gameId)
    .maybeSingle();

  if (result) {
    return { error: LEAVE_REFUSED_RESULT };
  }

  const { error } = await supabase
    .from("game_players")
    .delete()
    .eq("game_id", gameId)
    .eq("user_id", userId);

  if (error) {
    console.error("Could not leave game:", error.message);
    return { error: error.message };
  }

  // The spot frees itself: every count in the app is derived live from
  // game_players (the old current_players column is unused), and chat
  // membership is derived the same way — so canUserChat now returns false
  // and the thread drops off their /chat list. Their existing messages stay
  // in the thread; leaving a conversation isn't the same as erasing what
  // was said in it.
  return { ok: true };
}

// The organiser takes a player out of their game. Everything happens inside
// the remove_player_from_game database function, which is the real rule: it
// checks the caller is the organiser, refuses once a match result exists,
// records the removal (so they can't rejoin), frees the spot and notifies
// the removed player. The app only hides the button — this is the boundary.
export async function removePlayer(
  gameId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.rpc("remove_player_from_game", {
    p_game_id: Number(gameId),
    p_user_id: userId,
  });

  if (error) {
    console.error("Could not remove player:", error.message);
    // The function's refusals are written as sentences for people (no
    // result yet, not the organiser, etc.) — pass those through. Anything
    // else (network, function missing) gets a plain retry message.
    if (error.code === "23514" || error.code === "42501") {
      return { error: error.message };
    }
    return { error: "Couldn't remove that player. Please try again." };
  }

  return { ok: true };
}

// Was this person removed from this game by its organiser? Used to show
// them what happened instead of a Join button that would only fail.
export async function wasRemovedFrom(
  gameId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("game_removals")
    .select("id")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Before the migration runs the table doesn't exist — nobody has been
    // removed, which is the honest answer.
    console.error("Could not check removals:", error.message);
    return false;
  }
  return data != null;
}

// ---------------------------------------------------------------------------
// The waitlist — queueing for a game that is already full.
// ---------------------------------------------------------------------------
//
// Queued people live in their OWN table (game_waitlist), never in
// game_players. That is what keeps the 4/4 display, the match-result
// checks and the recurring-game roll correct without any of them knowing
// the waitlist exists — a queued person simply isn't a player yet.

// One person waiting, in queue order.
export type WaitlistEntry = {
  userId: string;
  joinedAt: string; // ISO timestamp — the queue order, never rewritten
};

// Everyone queued for a game, front of the queue first.
export async function getWaitlist(gameId: string): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase
    .from("game_waitlist")
    .select("user_id, joined_at")
    .eq("game_id", gameId)
    .order("joined_at", { ascending: true });

  if (error) {
    // Before the waitlist migration is run the table doesn't exist. An
    // empty queue is the honest answer then, and every screen degrades to
    // exactly the behaviour it had before the feature.
    console.error("Could not load the waitlist:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    userId: row.user_id as string,
    joinedAt: row.joined_at as string,
  }));
}

// Where this person sits in the queue, 1-based, or null if they aren't in
// it. 1 = next in line.
export function waitlistPositionOf(
  queue: WaitlistEntry[],
  userId: string | null,
): number | null {
  if (!userId) return null;
  const index = queue.findIndex((entry) => entry.userId === userId);
  return index === -1 ? null : index + 1;
}

// "1st" / "2nd" / "3rd" / "4th" — for showing someone their place.
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// The queue with names and avatars attached, front first — what the
// organiser sees under the roster. Same manual join as the roster itself
// (read the ids, then read those profiles in one more query).
export type WaitlistPlayer = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

export async function getWaitlistPlayers(
  gameId: string,
): Promise<WaitlistPlayer[]> {
  const queue = await getWaitlist(gameId);
  if (queue.length === 0) return [];

  const ids = queue.map((entry) => entry.userId);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", ids);

  const byId = new Map<string, { name?: string; avatar_url?: string }>();
  for (const row of profiles ?? []) {
    byId.set(row.id as string, row as { name?: string; avatar_url?: string });
  }

  // Queue order is authoritative — map over `queue`, not over `profiles`.
  return queue.map((entry) => {
    const profile = byId.get(entry.userId);
    return {
      userId: entry.userId,
      name: profile?.name ?? "Player",
      avatarUrl: profile?.avatar_url ?? null,
    };
  });
}

// Take a place in the queue for a full game.
export async function joinWaitlist(
  gameId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("game_waitlist")
    .insert({ game_id: gameId, user_id: userId });

  if (error) {
    console.error("Could not join the waitlist:", error.message);
    // 23505 is the unique (game_id, user_id) — they are already queued, so
    // the end state they wanted is already true.
    if (error.code === "23505") return { ok: true };
    return { error: "Couldn't join the queue. Give it another try." };
  }

  return { ok: true };
}

// Give up a place in the queue. Always allowed — unlike leaving a game,
// there is no match result to protect and no spot to strand, because a
// queued person was never in the game.
export async function leaveWaitlist(
  gameId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("game_waitlist")
    .delete()
    .eq("game_id", gameId)
    .eq("user_id", userId);

  if (error) {
    console.error("Could not leave the waitlist:", error.message);
    return { error: "Couldn't leave the queue. Give it another try." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Creating a game
// ---------------------------------------------------------------------------

// Is this error the database saying "that column doesn't exist yet"?
//
// price_per_player is added by a migration that may not have been run on
// this database yet. Sending a column that isn't there fails the WHOLE
// write, which would stop people creating or editing games at all — so we
// detect that specific failure and retry without the price. The game still
// saves; only the price is dropped, and the console says why.
//
// 42703 is Postgres's own undefined_column code. PGRST204 is PostgREST
// failing to find the column in its cached schema. The message check is a
// last resort for wrappers that pass neither code through.
function isMissingColumn(
  error: { code?: string; message?: string } | null,
  column: string,
): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes(column) && (msg.includes("column") || msg.includes("schema"));
}

// The details needed to create a new game (the form fields the user fills in).
export type NewGame = {
  venue: string;
  location: string;
  game_time: string; // an ISO timestamp, e.g. "2026-06-10T17:30:00+00:00"
  skill_level: string;
  max_players: number;
  group_id?: string; // set when this game is a group proposal (phase 2 of group chats)
  recurs_weekly?: boolean; // repeat this game weekly (the database rolls it forward)
  price_per_player?: number | null; // euro PER PLAYER; null = no price set
};

// Saves a brand-new game, recording who created it (created_by), then adds
// that creator as the FIRST player (a row in game_players). On success we
// return the new game's id so the caller can open that game's page.
export async function createGame(
  game: NewGame,
  userId: string,
): Promise<{ id: string } | { error: string }> {
  // 1. Create the game itself, stamped with the creator's user id.
  // recurs_weekly is only included when the box was actually ticked, so
  // ordinary creates keep working even before the recurring-games migration
  // has been run (an unknown column would make the whole insert fail).
  const row: Record<string, unknown> = {
    venue: game.venue,
    location: game.location,
    game_time: game.game_time,
    skill_level: game.skill_level,
    max_players: game.max_players,
    created_by: userId,
    group_id: game.group_id ?? null,
  };
  if (game.recurs_weekly) {
    row.recurs_weekly = true;
  }
  // Only sent when a price was actually typed, so an ordinary create is
  // unchanged when nobody sets one.
  if (game.price_per_player != null) {
    row.price_per_player = game.price_per_player;
  }

  const insertGame = () =>
    supabase
      .from("games")
      .insert(row)
      .select("id") // ask the database to hand back the new row's id
      .single();

  let { data, error } = await insertGame();

  // Price column not there yet? Save the game without it rather than
  // failing the create outright.
  if (error && "price_per_player" in row && isMissingColumn(error, "price_per_player")) {
    console.warn(
      "games.price_per_player is missing — creating this game without a price. Run the price migration.",
    );
    delete row.price_per_player;
    ({ data, error } = await insertGame());
  }

  if (error || !data) {
    console.error("Could not create game:", error?.message);
    return { error: error?.message ?? "Could not create the game." };
  }

  // 2. Add the creator as the first player of their own game.
  const { error: joinError } = await supabase
    .from("game_players")
    .insert({ game_id: data.id, user_id: userId });

  if (joinError) {
    console.error(
      "Game created but could not add creator as a player:",
      joinError.message,
    );
    return { error: joinError.message };
  }

  // The id might come back as a number; we use it in a web address, so we
  // turn it into text to match the rest of the app.
  return { id: String(data.id) };
}

// ---------------------------------------------------------------------------
// Editing a game
// ---------------------------------------------------------------------------

// The editable details of a game (the fields the creator can change on the edit
// form). These are the same columns as NewGame — everything except who created
// it, which never changes.
export type GameEdits = {
  venue: string;
  location: string;
  game_time: string; // an ISO timestamp, e.g. "2026-06-10T17:30:00+00:00"
  skill_level: string;
  max_players: number;
  price_per_player?: number | null; // euro PER PLAYER; null = clear the price
};

// Save changes to an existing game's row in the "games" table. Only the
// creator should reach this (the edit page checks that), but the database's
// row-level security is the real safeguard. Returns { ok: true } on success,
// or { error } with a message if something went wrong.
export async function updateGame(
  gameId: string,
  edits: GameEdits,
): Promise<{ ok: true } | { error: string }> {
  // Unlike createGame the price is sent even when it is null, because on
  // an edit null is a real instruction: clear the price back to not-set.
  const row: Record<string, unknown> = {
    venue: edits.venue,
    location: edits.location,
    game_time: edits.game_time,
    skill_level: edits.skill_level,
    max_players: edits.max_players,
    price_per_player: edits.price_per_player ?? null,
  };

  const saveGame = () => supabase.from("games").update(row).eq("id", gameId);

  let { error } = await saveGame();

  // Price column not there yet? Save everything else rather than blocking
  // the edit entirely.
  if (error && isMissingColumn(error, "price_per_player")) {
    console.warn(
      "games.price_per_player is missing — saving this game without the price. Run the price migration.",
    );
    delete row.price_per_player;
    ({ error } = await saveGame());
  }

  if (error) {
    console.error("Could not update game:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// Open or close a game to NEW joins by hand. This is the creator's override
// for the case the app can't see: they filled the last spot in person, or a
// arrangement fell through and they want the game listed again.
//
// It writes ONLY is_manually_closed. The roster is not touched, so the
// player count is exactly what it was — a 3-of-4 game stays 3 of 4, just
// closed. Nothing here fakes a full game.
//
// Only the creator should reach this (CreatorActions renders the control
// for nobody else), but the UI is not the safeguard — see the RLS note in
// the migration and README of this change.
export async function setGameClosed(
  gameId: string,
  closed: boolean,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("games")
    .update({ is_manually_closed: closed })
    .eq("id", gameId);

  if (error) {
    // Unlike the price, this column IS the whole action — there is nothing
    // sensible to fall back to, and silently succeeding would be a lie. Say
    // exactly what is wrong instead.
    if (isMissingColumn(error, "is_manually_closed")) {
      console.error(
        "games.is_manually_closed is missing — run the price/manual-close migration.",
      );
      return {
        error: "This needs the latest database update before it will work.",
      };
    }
    console.error("Could not change the game's closed state:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// Cancel a game. We do NOT delete the row — we mark it as cancelled by setting
// its "status" column to "cancelled", so the game (and its history) is kept.
// Only the creator should reach this (the button checks that); the database's
// row-level security is the real safeguard. Returns { ok: true } on success,
// or { error } with a message if something went wrong.
export async function cancelGame(
  gameId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("games")
    .update({ status: "cancelled" })
    .eq("id", gameId);

  if (error) {
    console.error("Could not cancel game:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// Stop a weekly repeat. Flips recurs_weekly off for EVERY game in the chain
// (they all share the same series_id — the root game's id — so one update
// covers root and successors alike). The current game itself stays exactly as
// it is; it just won't roll into next week any more. Only the creator should
// reach this (the button checks that); the database's row-level security is
// the real safeguard, since every game in a chain has the same created_by.
export async function stopRecurring(
  seriesId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("games")
    .update({ recurs_weekly: false })
    .eq("series_id", Number(seriesId));

  if (error) {
    console.error("Could not stop the weekly repeat:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Chat — per-game messages (the "messages" table). Each row is one chat
// message: who sent it (user_id), which game it belongs to (game_id), the text
// (body), and when it was sent (created_at).
// ---------------------------------------------------------------------------

// One chat message, paired with the sender's name (looked up from profiles).
export type ChatMessage = {
  id: number; // the message's unique id
  game_id: string; // which game it belongs to
  user_id: string; // who sent it
  body: string; // the message text
  created_at: string; // when it was sent (ISO timestamp)
  senderName: string; // the sender's profile name, or "Player" if unknown
  senderAvatarUrl: string | null; // the sender's uploaded photo URL, or null
};

// Read every message for ONE game, oldest first (so the newest sits at the
// bottom, like a normal chat). We look each sender's name up in "profiles"
// ourselves (matching profiles.id to the message's user_id), the same way the
// players list does — rather than relying on a database relationship.
export async function getMessages(gameId: string): Promise<ChatMessage[]> {
  // 1. The messages themselves, oldest at the top.
  const { data: rows, error } = await supabase
    .from("messages")
    .select("id, game_id, user_id, body, created_at")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Could not load messages:", error.message);
    // A thread that failed to load must not read as a thread nobody has
    // written in.
    throw new DataError("Could not load messages", error.message);
  }
  if (!rows || rows.length === 0) {
    return [];
  }

  // 2. The name + avatar of everyone who has sent a message here (each id once).
  const senderIds = Array.from(new Set(rows.map((row) => row.user_id as string)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", senderIds);

  const nameById = new Map<string, string>();
  const avatarById = new Map<string, string | null>();
  for (const profile of profiles ?? []) {
    nameById.set(profile.id as string, (profile.name as string | null) ?? "Player");
    avatarById.set(profile.id as string, (profile.avatar_url as string | null) ?? null);
  }

  // 3. Pair each message with its sender's name and avatar.
  return rows.map((row) => ({
    id: row.id as number,
    game_id: String(row.game_id),
    user_id: row.user_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    senderName: nameById.get(row.user_id as string) ?? "Player",
    senderAvatarUrl: avatarById.get(row.user_id as string) ?? null,
  }));
}

// Send a new chat message to a game, from the logged-in user. We trim the text
// and refuse to send anything empty. Returns { ok: true } on success, or
// { error } with a message if something went wrong.
export async function sendMessage(
  gameId: string,
  userId: string,
  body: string,
): Promise<{ ok: true } | { error: string }> {
  const text = body.trim();
  if (text.length === 0) {
    return { error: "Message is empty." };
  }

  const { error } = await supabase
    .from("messages")
    .insert({ game_id: gameId, user_id: userId, body: text });

  if (error) {
    console.error("Could not send message:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// Can this person take part in a game's chat? True if they've JOINED the game
// (a row in game_players) OR they CREATED it (their id is the game's
// created_by). Used to decide whether to show the chat input.
export async function canUserChat(
  gameId: string,
  userId: string,
): Promise<boolean> {
  // Did they create the game?
  const { data: game } = await supabase
    .from("games")
    .select("created_by")
    .eq("id", gameId)
    .maybeSingle();
  if (game && game.created_by === userId) {
    return true;
  }

  // Otherwise, are they one of the joined players?
  const { data: row } = await supabase
    .from("game_players")
    .select("user_id")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  return row != null;
}

// One row in the Chat tab: either a game conversation or a group conversation,
// each paired with a preview of its most recent message. `kind` tells you
// which — check it before reading `.game` or `.group`/`.memberCount`.
export type Conversation =
  | {
      kind: "game";
      game: Game; // the game this conversation belongs to
      lastMessageBody: string | null; // preview text, or null if no messages yet
      lastMessageAt: string | null; // when that last message was sent (ISO), or null
    }
  | {
      kind: "group";
      group: Group; // the group this conversation belongs to
      memberCount: number;
      lastMessageBody: string | null;
      lastMessageAt: string | null;
    };

// Build the Chat tab list for ONE person: every game they've JOINED or
// CREATED, plus every group they're a member of, each paired with a preview
// of its most recent message. Sorted so conversations with the newest message
// activity come first; conversations with no messages yet fall to the bottom
// (soonest game first among those, then groups by when they were created).
// Returns an empty list if they're in no games and no groups.
export async function getConversationsFor(
  userId: string,
): Promise<Conversation[]> {
  // 1. The games they've joined (their rows in game_players).
  const { data: joinedRows } = await supabase
    .from("game_players")
    .select("game_id")
    .eq("user_id", userId);
  const joinedIds = (joinedRows ?? []).map((row) => String(row.game_id));

  // 2. The games they created.
  const { data: createdGames } = await supabase
    .from("games")
    .select("*")
    .eq("created_by", userId);

  // 3. Merge both into one list with no duplicates (a game you created AND are
  //    a player in should appear only once). We key by the game's id.
  const byId = new Map<string, Game>();
  for (const game of createdGames ?? []) {
    byId.set(String(game.id), game as Game);
  }

  // Fetch any joined games we don't already have from the created list.
  const missingIds = joinedIds.filter((id) => !byId.has(id));
  if (missingIds.length > 0) {
    const { data: joinedGames } = await supabase
      .from("games")
      .select("*")
      .in("id", missingIds);
    for (const game of joinedGames ?? []) {
      byId.set(String(game.id), game as Game);
    }
  }

  const games = Array.from(byId.values());

  // 4. Find the most recent message in each of these games (skip the query
  //    entirely if they're in no games — no point asking for nothing).
  let gameConversations: Conversation[] = [];
  if (games.length > 0) {
    const gameIds = games.map((game) => String(game.id));
    const { data: msgs } = await supabase
      .from("messages")
      .select("game_id, body, created_at")
      .in("game_id", gameIds)
      .order("created_at", { ascending: false });

    const latestByGame = new Map<string, { body: string; created_at: string }>();
    for (const m of msgs ?? []) {
      const key = String(m.game_id);
      if (!latestByGame.has(key)) {
        latestByGame.set(key, {
          body: m.body as string,
          created_at: m.created_at as string,
        });
      }
    }

    // 5. Pair each game with its latest message (if any).
    gameConversations = games.map((game) => {
      const last = latestByGame.get(String(game.id));
      return {
        kind: "game" as const,
        game,
        lastMessageBody: last?.body ?? null,
        lastMessageAt: last?.created_at ?? null,
      };
    });
  }

  // 6. The group side — same idea, encapsulated in groups.ts since it's a
  //    self-contained set of bounded queries (groups, member counts, latest
  //    messages), not a per-row loop.
  const groupData = await getGroupConversationsFor(userId);
  const groupConversations: Conversation[] = groupData.map((d) => ({
    kind: "group" as const,
    group: d.group,
    memberCount: d.memberCount,
    lastMessageBody: d.lastMessageBody,
    lastMessageAt: d.lastMessageAt,
  }));

  const conversations = [...gameConversations, ...groupConversations];
  if (conversations.length === 0) {
    return [];
  }

  // 7. Sort: conversations with messages first (newest activity at the top);
  //    conversations with no messages yet go below them (soonest game first
  //    among those; a group with no messages sorts by when it was created).
  conversations.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) {
      return (
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
      );
    }
    if (a.lastMessageAt) return -1; // a has messages, b doesn't → a first
    if (b.lastMessageAt) return 1; // b has messages, a doesn't → b first
    // Neither has messages → earliest "anchor" time first (a game's
    // game_time, or a group's created_at).
    const aTime =
      a.kind === "game"
        ? new Date(a.game.game_time).getTime()
        : new Date(a.group.created_at).getTime();
    const bTime =
      b.kind === "game"
        ? new Date(b.game.game_time).getTime()
        : new Date(b.group.created_at).getTime();
    return aTime - bTime;
  });

  return conversations;
}
