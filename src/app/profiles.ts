// This file reads and writes a player's PROFILE — their name, skill level, and
// home area — using your Supabase "profiles" table.
//
// Each row in "profiles" belongs to one logged-in person. Its id is the SAME
// id Supabase gives that person when they sign up (their "auth user id"), so a
// profile and an account are always linked together.

import { supabase } from "@/lib/supabaseClient";

// The shape of one profile — these names match the columns in your Supabase
// "profiles" table.
export type Profile = {
  id: string; // matches the person's auth user id
  name: string | null; // what they want to be called
  skill_level: string | null; // Beginner / Improver / Intermediate / Advanced / Pro
  home_area: string | null; // the area they usually play in (older field)
  home_club: string | null; // their home padel club
  bio: string | null; // a short "about me" they can write
  avatar_url: string | null; // public URL of their uploaded photo, if any
  created_at?: string; // when the profile was first created
};

// Fetch ONE person's profile by their user id. Returns the profile, or null if
// they don't have one yet (for example, right after signing up).
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId) // "where id equals this person's id"
    .maybeSingle(); // 0 or 1 rows — don't treat "no row yet" as an error

  if (error) {
    console.error("Could not load profile:", error.message);
    return null;
  }

  return data;
}

// The details collected on the sign-up form that become the first profile.
export type NewProfile = {
  name: string;
  skill_level: string;
};

// Create a person's profile row, using their user id as the profile's id.
// We use "upsert" (update-or-insert) so that if a profile somehow already
// exists, this updates it instead of failing. Returns { ok: true } on success
// or { error } with a message if something went wrong.
export async function createProfile(
  userId: string,
  profile: NewProfile,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    name: profile.name,
    skill_level: profile.skill_level,
  });

  if (error) {
    console.error("Could not create profile:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// The fields a person can edit on their profile page.
export type ProfileEdits = {
  name: string;
  skill_level: string;
  home_area: string;
};

// Save changes a person made to their own profile. We use "upsert"
// (update-or-insert): if this person already has a profile row it's updated;
// if they don't have one yet, it's created. The row's id is the logged-in
// person's auth user id, so it always lines up with their account. Returns
// { ok: true } on success or { error } with a message if something went wrong.
export async function updateProfile(
  userId: string,
  edits: ProfileEdits,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("profiles").upsert({
    id: userId, // matches their account; decides update-vs-create
    name: edits.name,
    skill_level: edits.skill_level,
    home_area: edits.home_area,
  });

  if (error) {
    console.error("Could not save profile:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Player profile page — the fuller profile edited on /players/[id].
// ---------------------------------------------------------------------------

// The five skill levels a player can choose, in order. Used by the edit form's
// dropdown and kept here so there's one source of truth.
export const SKILL_LEVELS = [
  "Beginner",
  "Improver",
  "Intermediate",
  "Advanced",
  "Pro",
] as const;

// The fields editable on the player profile page. avatar_url is set by the
// upload step (uploadAvatar) before saving, so it's optional here.
export type PlayerProfileEdits = {
  name: string;
  skill_level: string;
  home_club: string;
  bio: string;
  avatar_url?: string | null;
};

// Save changes a person made to their own player profile. Uses "upsert"
// (update-or-insert) keyed on their auth user id, so it creates the row if it
// doesn't exist yet and updates it otherwise. Only the columns we pass are
// touched — older fields like home_area are left untouched. Returns
// { ok: true } on success or { error } with a message on failure.
export async function savePlayerProfile(
  userId: string,
  edits: PlayerProfileEdits,
): Promise<{ ok: true } | { error: string }> {
  // Build the row from only the fields we mean to change. avatar_url is added
  // just when it was provided, so a plain text save never wipes an existing
  // photo.
  const row: Record<string, unknown> = {
    id: userId,
    name: edits.name,
    skill_level: edits.skill_level,
    home_club: edits.home_club,
    bio: edits.bio,
  };
  if (edits.avatar_url !== undefined) {
    row.avatar_url = edits.avatar_url;
  }

  const { error } = await supabase.from("profiles").upsert(row);

  if (error) {
    console.error("Could not save profile:", error.message);
    return { error: error.message };
  }

  return { ok: true };
}

// Upload a new avatar photo for a person to the public "avatars" storage
// bucket. We always write to the SAME path (`<userId>/avatar`) and overwrite
// it (upsert), so a player only ever has one avatar file — uploads don't pile
// up. On success we return the file's public URL with a cache-busting suffix
// so the new photo shows immediately instead of a stale cached one.
export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<{ url: string } | { error: string }> {
  const path = `${userId}/avatar`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true, // overwrite the existing file instead of failing/duplicating
      contentType: file.type || "image/*",
    });

  if (error) {
    console.error("Could not upload avatar:", error.message);
    return { error: error.message };
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // The path never changes, so browsers would cache the old image. A
  // timestamp query string makes each new upload a fresh URL.
  return { url: `${data.publicUrl}?v=${Date.now()}` };
}

// ---------------------------------------------------------------------------
// Finding players — the search screen (/search).
// ---------------------------------------------------------------------------

// One person in the search results — just the bits the list needs to show them.
export type ProfileSearchResult = {
  id: string;
  name: string | null;
  skill_level: string | null;
  home_club: string | null;
  avatar_url: string | null;
};

// Find players whose display name contains `query` (case-insensitive, partial
// match), leaving out the person doing the searching. Returns up to 30 matches
// sorted by name, or an empty list (including when the search box is empty).
export async function searchProfiles(
  query: string,
  excludeUserId: string | null,
): Promise<ProfileSearchResult[]> {
  const term = query.trim();
  if (term === "") return [];

  // Treat % and _ typed by the user as literal characters, not ilike wildcards.
  const escaped = term.replace(/[\\%_]/g, (m) => `\\${m}`);

  let request = supabase
    .from("profiles")
    .select("id, name, skill_level, home_club, avatar_url")
    .ilike("name", `%${escaped}%`) // case-insensitive partial match on name
    .order("name", { ascending: true })
    .limit(30);

  if (excludeUserId) {
    request = request.neq("id", excludeUserId); // never show yourself
  }

  const { data, error } = await request;

  if (error) {
    console.error("Could not search players:", error.message);
    return [];
  }

  return (data ?? []) as ProfileSearchResult[];
}
