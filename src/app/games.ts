// This file used to hold hand-typed games. Now it reads REAL games from your
// Supabase "games" table instead. The screens call the two functions below.

import { supabase } from "@/lib/supabaseClient";

// The shape of one game — these names match the columns in your Supabase
// "games" table exactly.
export type Game = {
  id: string; // unique label for the game (used in the web address)
  venue: string; // name of the padel club / court
  location: string; // where it is (neighbourhood / town)
  game_time: string; // when the game is happening
  skill_level: string; // the skill level the game is aimed at
  max_players: number; // total spots in the game
  current_players: number; // how many have joined so far
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

// The details needed to create a new game. These match the form fields the
// user fills in (current_players is NOT here — we always set it to 1 ourselves).
export type NewGame = {
  venue: string;
  location: string;
  game_time: string; // an ISO timestamp, e.g. "2026-06-10T17:30:00+00:00"
  skill_level: string;
  max_players: number;
};

// Saves a brand-new game to the database. The creator counts as the first
// player, so current_players starts at 1. On success we return the new game's
// id so the caller can send the user to that game's page.
export async function createGame(
  game: NewGame,
): Promise<{ id: string } | { error: true }> {
  const { data, error } = await supabase
    .from("games")
    .insert({
      venue: game.venue,
      location: game.location,
      game_time: game.game_time,
      skill_level: game.skill_level,
      max_players: game.max_players,
      current_players: 1, // the person creating the game is the first to join
    })
    .select("id") // ask the database to hand back the new row's id
    .single();

  if (error || !data) {
    console.error("Could not create game:", error?.message);
    return { error: true };
  }

  // The id might come back as a number; we use it in a web address, so we
  // turn it into text to match the rest of the app.
  return { id: String(data.id) };
}

// What joinGame tells the caller after it tries to add a player:
//  - { newCount }  -> success; newCount is the updated current_players number
//  - { full: true } -> the game was already full, nothing changed
//  - { error: true } -> something went wrong talking to the database
export type JoinResult =
  | { newCount: number }
  | { full: true }
  | { error: true };

// Adds ONE player to a game in the database (used by the Join button).
// We first read the latest numbers so we don't accidentally over-fill a game
// that other people may have joined since this screen loaded.
export async function joinGame(id: string): Promise<JoinResult> {
  // 1. Read the game's current and maximum players, fresh from the database.
  const { data: latest, error: readError } = await supabase
    .from("games")
    .select("current_players, max_players")
    .eq("id", id)
    .single();

  if (readError || !latest) {
    console.error("Could not read game before joining:", readError?.message);
    return { error: true };
  }

  // 2. If it's already full, stop here and report that — don't change anything.
  if (latest.current_players >= latest.max_players) {
    return { full: true };
  }

  // 3. Write the new, higher count back to the database.
  const newCount = latest.current_players + 1;
  const { data: updated, error: updateError } = await supabase
    .from("games")
    .update({ current_players: newCount })
    .eq("id", id)
    .lt("current_players", latest.max_players) // safety: only if still not full
    .select("current_players")
    .single();

  if (updateError || !updated) {
    console.error("Could not join game:", updateError?.message);
    return { error: true };
  }

  return { newCount: updated.current_players };
}
