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
  skill_level: string | null; // Beginner / Intermediate / Advanced
  home_area: string | null; // the area they usually play in
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
