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
};

// Save changes to an existing game's row in the "games" table. Only the
// creator should reach this (the edit page checks that), but the database's
// row-level security is the real safeguard. Returns { ok: true } on success,
// or { error } with a message if something went wrong.
export async function updateGame(
  gameId: string,
  edits: GameEdits,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("games")
    .update({
      venue: edits.venue,
      location: edits.location,
      game_time: edits.game_time,
      skill_level: edits.skill_level,
      max_players: edits.max_players,
    })
    .eq("id", gameId);

  if (error) {
    console.error("Could not update game:", error.message);
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
    return [];
  }
  if (!rows || rows.length === 0) {
    return [];
  }

  // 2. The names of everyone who has sent a message here (each id only once).
  const senderIds = Array.from(new Set(rows.map((row) => row.user_id as string)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", senderIds);

  const nameById = new Map<string, string>();
  for (const profile of profiles ?? []) {
    nameById.set(profile.id as string, (profile.name as string | null) ?? "Player");
  }

  // 3. Pair each message with its sender's name.
  return rows.map((row) => ({
    id: row.id as number,
    game_id: String(row.game_id),
    user_id: row.user_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    senderName: nameById.get(row.user_id as string) ?? "Player",
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

// One row in the Chat tab: a game the person is part of, plus a preview of the
// most recent message in that game's thread (if there is one yet).
export type Conversation = {
  game: Game; // the game this conversation belongs to
  lastMessageBody: string | null; // preview text, or null if no messages yet
  lastMessageAt: string | null; // when that last message was sent (ISO), or null
};

// Build the Chat tab list for ONE person: every game they've JOINED or CREATED,
// each paired with a preview of its most recent message. Sorted so games with
// the newest message activity come first; games with no messages yet fall to
// the bottom. Returns an empty list if they're in no games.
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
  if (games.length === 0) {
    return [];
  }

  // 4. Find the most recent message in each of these games. We pull every
  //    message for them newest-first, then keep the first (latest) one we see
  //    per game.
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
  const conversations: Conversation[] = games.map((game) => {
    const last = latestByGame.get(String(game.id));
    return {
      game,
      lastMessageBody: last?.body ?? null,
      lastMessageAt: last?.created_at ?? null,
    };
  });

  // 6. Sort: games with messages first (newest activity at the top); games with
  //    no messages yet go below them (soonest game first among those).
  conversations.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) {
      return (
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
      );
    }
    if (a.lastMessageAt) return -1; // a has messages, b doesn't → a first
    if (b.lastMessageAt) return 1; // b has messages, a doesn't → b first
    // Neither has messages → soonest game first.
    return (
      new Date(a.game.game_time).getTime() -
      new Date(b.game.game_time).getTime()
    );
  });

  return conversations;
}
