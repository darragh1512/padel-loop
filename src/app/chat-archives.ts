// Archived chats: the "chat_archives" table. Each row is one person moving one
// chat (a game chat or a group chat) into the Archived section of THEIR OWN
// Chats tab. Like pins, it is personal: Row Level Security means a person only
// ever sees and changes their own rows, so archiving never touches anyone
// else's list. See supabase/migrations/20261108120000_chat_archives.sql.
//
// Cancelled games are archived for everyone without a row here: the Chats tab
// files them under Archived by their status.

import { supabase } from "@/lib/supabaseClient";
import { pinKey, type ChatKind } from "./chat-pins";

// Every chat this person has archived, as pinKey()s.
export async function getArchivedKeys(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("chat_archives").select("game_id, group_id").eq("user_id", userId);
  if (error) {
    // Before the migration runs the table doesn't exist. Nothing archived is
    // the honest answer, and Chats looks as it did before.
    console.error("Could not load archived chats:", error.message);
    return new Set();
  }
  const keys = new Set<string>();
  for (const row of data ?? []) {
    if (row.game_id != null) keys.add(pinKey("game", String(row.game_id)));
    else if (row.group_id != null) keys.add(pinKey("group", String(row.group_id)));
  }
  return keys;
}

export async function archiveChat(userId: string, kind: ChatKind, id: string): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("chat_archives").insert({
    user_id: userId,
    game_id: kind === "game" ? Number(id) : null,
    group_id: kind === "group" ? Number(id) : null,
  });
  // 23505 = already archived (in another tab, say): the end state is already true.
  if (error && error.code !== "23505") {
    console.error("Could not archive chat:", error.message);
    return { error: "Couldn’t archive that chat. Try again." };
  }
  return { ok: true };
}

export async function unarchiveChat(userId: string, kind: ChatKind, id: string): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("chat_archives")
    .delete()
    .eq("user_id", userId)
    .eq(kind === "game" ? "game_id" : "group_id", id);
  if (error) {
    console.error("Could not unarchive chat:", error.message);
    return { error: "Couldn’t unarchive that chat. Try again." };
  }
  return { ok: true };
}
