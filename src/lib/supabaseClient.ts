// This file sets up the "client" — the piece of code that knows how to talk
// to your Supabase database. We create it once here and reuse it everywhere.

import { createClient } from "@supabase/supabase-js";

// These two values are read from the .env.local file (your secrets).
// The "!" at the end just promises TypeScript that these values exist.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// "supabase" is the ready-to-use connection. Other files import this to
// read games from the database.
export const supabase = createClient(supabaseUrl, supabasePublishableKey);
