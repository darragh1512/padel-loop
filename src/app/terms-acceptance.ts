// Proof that a player agreed to the Terms of Use and Privacy Policy — the
// sign-up tick-box, recorded in the append-only `terms_acceptances` table
// (supabase/migrations/20261012000000_terms_acceptances.sql). The database
// stamps the time itself; we only say which versions they saw.

import { supabase } from "@/lib/supabaseClient";

// The "Last updated" dates at the top of content/terms.md and
// content/privacy.md. CHANGE THESE WHENEVER THOSE DATES CHANGE, or new
// agreements will be recorded against the old wording.
export const TERMS_VERSION = "2026-09-09";
export const PRIVACY_VERSION = "2026-09-09";

// Record that the signed-in player agreed just now. Never throws and never
// blocks sign-up: a failure is logged, and the account is still created.
export async function recordTermsAcceptance(): Promise<void> {
  const { error } = await supabase.from("terms_acceptances").insert({
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
  });

  if (error) {
    console.error("Could not record terms acceptance:", error.message);
  }
}
