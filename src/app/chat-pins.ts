// Pinned chats — the "chat_pins" table. Each row is one person pinning one
// chat (a game chat OR a group chat) to the top of THEIR OWN Chat tab.
//
// Row Level Security means every query here only ever sees the signed-in
// person's own pins, so pinning never touches anyone else's list. The
// three-pin limit and "only chats you're in" are enforced by the database
// (see supabase/migrations/20260928010000_chat_pins.sql); the checks in the
// app are only there to answer sooner and in a friendlier way.

import { supabase } from "@/lib/supabaseClient";

export const MAX_PINS = 3;

export const PIN_LIMIT_MESSAGE = "You can pin up to 3 chats. Unpin one first.";

export type ChatKind = "game" | "group";

// A pin's identity, prefixed with its kind — a game and a group can share
// the same numeric id, so the bare id isn't enough.
export function pinKey(kind: ChatKind, id: string): string {
  return `${kind}:${id}`;
}

// Every chat this person has pinned, as pinKey()s.
export async function getPinnedKeys(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("chat_pins")
    .select("game_id, group_id")
    .eq("user_id", userId);

  if (error) {
    // Before the migration runs the table doesn't exist. No pins is the
    // honest answer, and the Chat tab looks exactly as it did before.
    console.error("Could not load pinned chats:", error.message);
    return new Set();
  }

  const keys = new Set<string>();
  for (const row of data ?? []) {
    if (row.game_id != null) keys.add(pinKey("game", String(row.game_id)));
    else if (row.group_id != null) keys.add(pinKey("group", String(row.group_id)));
  }
  return keys;
}

export async function pinChat(
  userId: string,
  kind: ChatKind,
  id: string,
): Promise<{ ok: true } | { error: string; limit?: true }> {
  const { error } = await supabase.from("chat_pins").insert({
    user_id: userId,
    game_id: kind === "game" ? Number(id) : null,
    group_id: kind === "group" ? Number(id) : null,
  });

  if (error) {
    // 23505 = already pinned (e.g. pinned in another tab) — the end state
    // they wanted is already true.
    if (error.code === "23505") return { ok: true };
    // 23514 = the three-pin limit.
    if (error.code === "23514") return { error: PIN_LIMIT_MESSAGE, limit: true };
    console.error("Could not pin chat:", error.message);
    return { error: "Couldn't pin that chat. Please try again." };
  }
  return { ok: true };
}

export async function unpinChat(
  userId: string,
  kind: ChatKind,
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("chat_pins")
    .delete()
    .eq("user_id", userId)
    .eq(kind === "game" ? "game_id" : "group_id", id);

  if (error) {
    console.error("Could not unpin chat:", error.message);
    return { error: "Couldn't unpin that chat. Please try again." };
  }
  return { ok: true };
}
