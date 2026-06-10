// This file reads REAL games from your Supabase "games" table, and now also
// handles WHO has joined each game via the separate "game_players" table.
//
// Important change: we no longer use the old "current_players" number column.
// The count of players is now worked out from the game_players table, where
// each row links one user to one game.

import { supabase } from "@/lib/supabaseClient";

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
};

// Turns a stored timestamp (e.g. "2026-06-10T17:30:00+00:00") into friendly
// text like "Wed, 10 Jun, 5:30 pm". If the value isn't a date we understand,
// we just show it unchanged so nothing breaks.
// Note: we display the time in UTC, the same timezone it's stored in, so the
// time you typed in Supabase is exactly the time shown on screen.
export function formatGameTime(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
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
export async function leaveGame(
  gameId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("game_players")
    .delete()
    .eq("game_id", gameId)
    .eq("user_id", userId);

  if (error) {
    console.error("Could not leave game:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Creating a game
// ---------------------------------------------------------------------------

// The details needed to create a new game (the form fields the user fills in).
export type NewGame = {
  venue: string;
  location: string;
  game_time: string; // an ISO timestamp, e.g. "2026-06-10T17:30:00+00:00"
  skill_level: string;
  max_players: number;
};

// Saves a brand-new game, recording who created it (created_by), then adds
// that creator as the FIRST player (a row in game_players). On success we
// return the new game's id so the caller can open that game's page.
export async function createGame(
  game: NewGame,
  userId: string,
): Promise<{ id: string } | { error: string }> {
  // 1. Create the game itself, stamped with the creator's user id.
  const { data, error } = await supabase
    .from("games")
    .insert({
      venue: game.venue,
      location: game.location,
      game_time: game.game_time,
      skill_level: game.skill_level,
      max_players: game.max_players,
      created_by: userId,
    })
    .select("id") // ask the database to hand back the new row's id
    .single();

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
