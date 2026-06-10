import { supabase } from "@/lib/supabaseClient";
import type { Game, Player } from "./types";

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
    .select("id, name, skill_level")
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
    } satisfies Player;
  });
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
    distanceKm: undefined, // no distance/location coordinates in our schema yet
    startsAt: row.game_time, // our timestamp column
    durationMins: 90, // not stored yet — default
    levelMin,
    levelMax,
    format: "doubles", // not stored yet — default
    maxPlayers: row.max_players ?? 4,
    courtFee: 44, // not stored yet — placeholder so the cost split renders
    players, // real joined players (from game_players); empty list = open slots
  };
}

export async function getGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("game_time", { ascending: true })
    .limit(20);
  if (!error && data && data.length > 0) return data.map((row) => rowToGame(row));
  return MOCK_GAMES;
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
  return MOCK_GAMES.find((g) => g.id === id) ?? MOCK_GAMES[0];
}

/* ── Mock data (used only if the games query fails or is empty) ─────── */
const tonight = (h: number, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const tomorrowAt = (h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

export const MOCK_GAMES: Game[] = [
  {
    id: "1",
    venue: "Malahide Padel Club",
    courtLabel: "Court 2 · Outdoor panoramic",
    distanceKm: 1.2,
    startsAt: tonight(18, 30),
    durationMins: 90,
    levelMin: 3.0,
    levelMax: 4.0,
    format: "doubles",
    maxPlayers: 4,
    courtFee: 44,
    players: [
      { id: "p1", name: "Jonny K.", initials: "JK", level: 3.6, gamesPlayed: 41, isOrganiser: true },
      { id: "p2", name: "Sarah M.", initials: "SM", level: 3.1, gamesPlayed: 12 },
      { id: "p3", name: "Conor B.", initials: "CB", level: 3.4, gamesPlayed: 27 },
    ],
  },
  {
    id: "2",
    venue: "Portmarnock Sports & Leisure",
    distanceKm: 3.8,
    startsAt: tonight(20, 0),
    durationMins: 90,
    levelMin: 2.5,
    levelMax: 3.5,
    format: "doubles",
    maxPlayers: 4,
    courtFee: 40,
    players: [
      { id: "p4", name: "Eve O.", initials: "EO", level: 2.9 },
      { id: "p5", name: "Tom R.", initials: "TR", level: 3.2 },
    ],
  },
  {
    id: "3",
    venue: "Clontarf Padel Centre",
    distanceKm: 7.4,
    startsAt: tomorrowAt(7),
    durationMins: 90,
    levelMin: 3.5,
    levelMax: 4.5,
    format: "doubles",
    maxPlayers: 4,
    courtFee: 48,
    players: [
      { id: "p6", name: "Liam D.", initials: "LD", level: 3.8 },
      { id: "p7", name: "Paul W.", initials: "PW", level: 4.1 },
      { id: "p8", name: "Mark K.", initials: "MK", level: 3.7 },
    ],
  },
];
