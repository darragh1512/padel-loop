// This file reads and writes player CONNECTIONS — the "padel friends" link
// between two players — using your Supabase "connections" table.
//
// Each row links two people: requester_id (who tapped Connect) and
// addressee_id (who they connected to), plus a status. For now connecting is
// frictionless: a new row is created already "accepted", with no approval step.
// The primary key is the (requester_id, addressee_id) pair, so the same pair in
// the same direction can only exist once.
//
// A connection is "mutual" — it counts the same whichever way round the two ids
// sit — so almost everything here checks BOTH directions (a↔b).

import { supabase } from "@/lib/supabaseClient";

// One row of the "connections" table.
export type Connection = {
  requester_id: string;
  addressee_id: string;
  status: string;
};

// The "other person" in one of my connections, with the bits the list/profile
// screens need to show them (matches columns in "profiles").
export type ConnectionProfile = {
  id: string;
  name: string | null;
  skill_level: string | null;
  home_club: string | null;
  avatar_url: string | null;
};

// A PostgREST "or" fragment matching the pair a↔b in EITHER direction:
//   (requester=a AND addressee=b) OR (requester=b AND addressee=a)
function eitherDirection(a: string, b: string): string {
  return `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`;
}

// Is there an ACCEPTED connection between these two people (either direction)?
// Used to decide whether the button reads "Connect" or "Connected".
export async function areConnected(
  userA: string,
  userB: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("connections")
    .select("requester_id")
    .eq("status", "accepted")
    .or(eitherDirection(userA, userB))
    .limit(1);

  if (error) {
    console.error("Could not check connection:", error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

// How many ACCEPTED connections involve this person (in either direction)?
// Shown on every profile. Returns 0 if it can't be read.
export async function getConnectionCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("connections")
    .select("*", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) {
    console.error("Could not count connections:", error.message);
    return 0;
  }

  return count ?? 0;
}

// Connect the current user (requester) to another player (addressee). The row
// is created already "accepted" — no approval step for now. Returns { ok: true }
// on success or { error } with a message if something went wrong.
export async function connect(
  requesterId: string,
  addresseeId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("connections").insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: "accepted",
  });

  if (error) {
    console.error("Could not connect:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// Remove the connection between two people, whichever direction it was made in
// (either person can disconnect). Returns { ok: true } on success or { error }.
export async function disconnect(
  userA: string,
  userB: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("connections")
    .delete()
    .or(eitherDirection(userA, userB));

  if (error) {
    console.error("Could not disconnect:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// Build the "my connections" list for one person: every player they have an
// accepted connection with (either direction), as a profile we can render.
// Returns the people sorted by name, or an empty list.
export async function getConnections(
  userId: string,
): Promise<ConnectionProfile[]> {
  // 1. Every accepted connection row that involves this person.
  const { data: rows, error } = await supabase
    .from("connections")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) {
    console.error("Could not load connections:", error.message);
    return [];
  }

  // 2. The OTHER person in each row is whichever id isn't me. De-duplicate in
  //    case the same pair somehow exists both ways round.
  const otherIds = Array.from(
    new Set(
      (rows ?? []).map((row) =>
        row.requester_id === userId
          ? (row.addressee_id as string)
          : (row.requester_id as string),
      ),
    ),
  );
  if (otherIds.length === 0) {
    return [];
  }

  // 3. Look those people up in "profiles".
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, skill_level, home_club, avatar_url")
    .in("id", otherIds);

  if (profileError) {
    console.error("Could not load connection profiles:", profileError.message);
    return [];
  }

  return (profiles ?? []).sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? ""),
  ) as ConnectionProfile[];
}
