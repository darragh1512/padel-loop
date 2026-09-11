// Blocking — one-directional, and invisible to the person blocked.
//
// A row in `blocks` is an assertion by the blocker about what THEY see. It
// says nothing about what the blocked person sees. B can still view A, post in
// a shared thread and join a game A is in; they simply never learn that A
// stopped seeing them.
//
// The invisibility is enforced by RLS (`select ... using (blocker_id =
// auth.uid())`), not by these functions being careful — a blocked person
// cannot read a row naming them even by calling the API directly. Nothing here
// should ever expose "who has blocked me", and no function in this file takes
// the blocked person's point of view.

import { supabase } from "@/lib/supabaseClient";
import { DataError } from "@/lib/loadable";

export type BlockedPerson = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

/* Everyone the signed-in user has blocked, newest first. RLS means this can
   only ever return their own rows, so no filter is needed here. */
export async function getBlockedIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);

  if (error) {
    // Before the migration is run the table doesn't exist. An empty set means
    // every screen behaves exactly as it did before blocking existed, rather
    // than failing to render.
    console.error("Could not load blocks:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.blocked_id as string));
}

/* The blocked list for the settings screen — with names attached. */
export async function getBlockedPeople(userId: string): Promise<BlockedPerson[]> {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load blocked people:", error.message);
    throw new DataError("Could not load blocked people", error.message);
  }
  if (!data || data.length === 0) return [];

  const ids = data.map((row) => row.blocked_id as string);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", ids);

  const byId = new Map<string, { name?: string; avatar_url?: string }>();
  for (const row of profiles ?? []) {
    byId.set(row.id as string, row as { name?: string; avatar_url?: string });
  }

  return data.map((row) => {
    const profile = byId.get(row.blocked_id as string);
    return {
      userId: row.blocked_id as string,
      name: profile?.name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      createdAt: row.created_at as string,
    };
  });
}

/* Is this one person blocked by the signed-in user? Used by the profile
   screen to pick between Block and Unblock. */
export async function isBlocked(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();

  if (error) {
    console.error("Could not check block:", error.message);
    return false;
  }
  return data != null;
}

/* Block somebody. Any connection between the two is dropped by a database
   trigger rather than a second call from here, so a block can never land
   while the two of them stay connected. */
export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  if (error) {
    // 23505 = already blocked. The end state they wanted is already true.
    if (error.code === "23505") return { ok: true };
    console.error("Could not block:", error.message);
    return { error: "Couldn't block that person. Please try again." };
  }
  return { ok: true };
}

/* Unblock. Deliberately does NOT restore the connection that blocking
   removed — reconnecting is a decision, not an undo. */
export async function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);

  if (error) {
    console.error("Could not unblock:", error.message);
    return { error: "Couldn't unblock that person. Please try again." };
  }
  return { ok: true };
}
