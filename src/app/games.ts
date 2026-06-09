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
