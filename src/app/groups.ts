// This file reads and writes GROUP chats using your Supabase "groups" and
// "group_members" tables, and the shared "messages" table (a message belongs
// to a game OR a group, never both — see the messages_game_xor_group_chk
// constraint).
//
// Groups are invite/add-only: there's no discovery or browsing. A group is
// created by one person (its first member); after that, any member can add
// anyone else, and any member can leave (but not remove someone else — that's
// not in this phase).

import { supabase } from "@/lib/supabaseClient";

// The shape of one group — matches the "groups" table.
export type Group = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

// One member of a group, paired with the bits of their profile the UI needs
// (same manual join pattern as game rosters / chat senders elsewhere).
export type GroupMemberProfile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

// Fetch ONE group by its id. Returns null if it doesn't exist — or if RLS
// hides it because the caller isn't a member.
export async function getGroup(id: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Could not load group:", error.message);
    return null;
  }
  return (data as Group) ?? null;
}

// Everyone in ONE group, with their name + avatar. Used for the thread
// header's member count and the "add member" picker's exclude list.
export async function getGroupMembers(
  groupId: string,
): Promise<GroupMemberProfile[]> {
  const { data: rows, error } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);

  if (error) {
    console.error("Could not load group members:", error.message);
    return [];
  }
  const ids = (rows ?? []).map((row) => row.user_id as string);
  if (ids.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", ids);

  if (profileError) {
    console.error("Could not load member profiles:", profileError.message);
    return [];
  }
  return (profiles ?? []) as GroupMemberProfile[];
}

// The ids of every group this person belongs to.
export async function getUserGroupIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Could not load group memberships:", error.message);
    return [];
  }
  return (data ?? []).map((row) => String(row.group_id));
}

// One row of the Chat tab's group side: a group plus its member count and a
// preview of its most recent message (same shape games.ts pairs games with).
export type GroupConversationData = {
  group: Group;
  memberCount: number;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
};

// Build the group half of the Chat tab list for ONE person: every group
// they're in, each paired with its member count and latest message preview.
// Three bounded queries regardless of how many groups they're in — no
// per-group loop. Returns an empty list if they're in no groups.
export async function getGroupConversationsFor(
  userId: string,
): Promise<GroupConversationData[]> {
  const groupIds = await getUserGroupIds(userId);
  if (groupIds.length === 0) return [];

  // 1. The groups themselves.
  const { data: groups } = await supabase
    .from("groups")
    .select("*")
    .in("id", groupIds);

  // 2. Every membership row for these groups, so we can count per group
  //    without a separate query per group.
  const { data: memberRows } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", groupIds);
  const countByGroup = new Map<string, number>();
  for (const row of memberRows ?? []) {
    const key = String(row.group_id);
    countByGroup.set(key, (countByGroup.get(key) ?? 0) + 1);
  }

  // 3. The most recent message in each group (same "newest first, keep the
  //    first one we see per group" approach as the game side).
  const { data: msgs } = await supabase
    .from("messages")
    .select("group_id, body, created_at")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false });
  const latestByGroup = new Map<string, { body: string; created_at: string }>();
  for (const m of msgs ?? []) {
    const key = String(m.group_id);
    if (!latestByGroup.has(key)) {
      latestByGroup.set(key, {
        body: m.body as string,
        created_at: m.created_at as string,
      });
    }
  }

  return (groups ?? []).map((row) => {
    const group = row as Group;
    const last = latestByGroup.get(String(group.id));
    return {
      group,
      memberCount: countByGroup.get(String(group.id)) ?? 0,
      lastMessageBody: last?.body ?? null,
      lastMessageAt: last?.created_at ?? null,
    };
  });
}

// Create a new group, then add the creator as its first member. Two calls,
// same shape as createGame's "create the game, then add the creator as the
// first player" — if the second call fails the group is left with no
// members, same best-effort philosophy as createGame.
export async function createGroup(
  name: string,
  creatorId: string,
): Promise<{ id: string } | { error: string }> {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { error: "Give the group a name." };
  }

  const { data, error } = await supabase
    .from("groups")
    .insert({ name: trimmed, created_by: creatorId })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Could not create group:", error?.message);
    return { error: error?.message ?? "Could not create the group." };
  }

  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: data.id, user_id: creatorId, added_by: creatorId });

  if (memberError) {
    console.error(
      "Group created but could not add creator as a member:",
      memberError.message,
    );
    return { error: memberError.message };
  }

  return { id: String(data.id) };
}

// Add another user to an existing group. Any existing member can do this
// (RLS enforces that — see the group_members insert policy).
export async function addGroupMember(
  groupId: string,
  userId: string,
  addedBy: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, user_id: userId, added_by: addedBy });

  if (error) {
    console.error("Could not add member:", error.message);
    return { error: error.message };
  }
  return { ok: true };
}

// Leave a group — deletes your OWN membership row only (no removing others).
export async function leaveGroup(
  groupId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) {
    console.error("Could not leave group:", error.message);
    return { error: error.message };
  }
  return { ok: true };
}

// Can this person take part in a group's chat? True if they're a member.
// Mirrors canUserChat's role for games — used to decide whether to show the
// chat input (RLS is the real enforcement; this just drives the UI).
export async function canUserChatInGroup(
  groupId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return data != null;
}

// ---------------------------------------------------------------------------
// Chat — group messages, via the same "messages" table games use (game_id is
// null on these rows, group_id is set). Mirrors games.ts's ChatMessage /
// getMessages / sendMessage exactly, just filtered by group_id instead.
// ---------------------------------------------------------------------------

export type GroupChatMessage = {
  id: number;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
  senderName: string;
  senderAvatarUrl: string | null;
};

// Read every message for ONE group, oldest first.
export async function getGroupMessages(
  groupId: string,
): Promise<GroupChatMessage[]> {
  const { data: rows, error } = await supabase
    .from("messages")
    .select("id, group_id, user_id, body, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Could not load group messages:", error.message);
    return [];
  }
  if (!rows || rows.length === 0) return [];

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

  return rows.map((row) => ({
    id: row.id as number,
    group_id: String(row.group_id),
    user_id: row.user_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    senderName: nameById.get(row.user_id as string) ?? "Player",
    senderAvatarUrl: avatarById.get(row.user_id as string) ?? null,
  }));
}

// Send a new chat message to a group, from the logged-in user.
export async function sendGroupMessage(
  groupId: string,
  userId: string,
  body: string,
): Promise<{ ok: true } | { error: string }> {
  const text = body.trim();
  if (text.length === 0) {
    return { error: "Message is empty." };
  }

  const { error } = await supabase
    .from("messages")
    .insert({ group_id: groupId, user_id: userId, body: text });

  if (error) {
    console.error("Could not send group message:", error.message);
    return { error: error.message };
  }
  return { ok: true };
}
