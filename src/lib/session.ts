// Who is signed in, answered from the sign-in already saved on this phone.
//
// supabase.auth.getUser() asks Supabase's servers every time, which cost a full
// round trip before any screen could start loading its data, and again on every
// tab tap. Screens only need to know which account is signed in. The database
// checks the saved sign-in on every request anyway (Row Level Security), so
// reading it locally loses no protection: a stale or forged sign-in still gets
// nothing from the database.
//
// Same shape as getUser()'s answer, so callers read data.user as before. An
// expired sign-in is renewed here by Supabase before it answers.

import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export async function getSignedInUser(): Promise<{ data: { user: User | null } }> {
  const { data } = await supabase.auth.getSession();
  return { data: { user: data.session?.user ?? null } };
}
