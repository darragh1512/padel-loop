"use client";

// First run. One screen, two questions, then straight to a game they can join.
//
// WHAT IT ASKS, AND WHAT IT DOESN'T
// Level is already captured at sign-up, so it arrives pre-filled and can be left
// alone. Home club is the only genuinely new question. Nothing else is asked.
// Every extra field here is a place to leave.
//
// WHERE IT SITS IN THE ROUTING, which is how the shared-link case is handled:
// only the HOME screen sends anyone here. A person arriving on /games/[id] from a
// WhatsApp link goes sign-up → back to that game → join, and never passes through
// this screen at all, because nothing on that path redirects.
//
// ENDING: Discover, but only if there is anything on it. If there are genuinely
// no games this says so here rather than handing them an empty list.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SkillLevelPicker from "@/components/SkillLevelPicker";
import { capture } from "@/lib/analytics";
import { loadGames } from "@/lib/data";
import { supabase } from "@/lib/supabaseClient";
import { getSignedInUser } from "@/lib/session";
import { getProfile, markOnboarded, updateProfile, SKILL_LEVELS } from "../profiles";

export default function WelcomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [skill, setSkill] = useState<string>(SKILL_LEVELS[0]);
  const [club, setClub] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The cold-start case: setup done, but there is genuinely nothing to join.
  const [noGames, setNoGames] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSignedInUser();
      const uid = data.user?.id ?? null;

      if (!uid) {
        router.replace("/login");
        return;
      }

      const profile = await getProfile(uid);
      if (!active) return;

      // Already done — never show this twice. Guards a bookmark or a back button
      // as well as a stale redirect.
      if (profile?.onboarded_at) {
        router.replace("/discover");
        return;
      }

      setUserId(uid);
      setName(profile?.name ?? "");
      if (profile?.skill_level) setSkill(profile.skill_level);
      setClub(profile?.home_club ?? "");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  // Setup is finished either way — the only difference is whether we saved
  // anything first. Both paths close the question so it cannot come back.
  async function finish(save: boolean) {
    if (!userId || saving) return;
    setSaving(true);
    setError(null);

    if (save) {
      const result = await updateProfile(userId, {
        name,
        skill_level: skill,
        home_area: club.trim(),
      });
      if ("error" in result) {
        setError("Couldn’t save that. Try again.");
        setSaving(false);
        return;
      }
      await savePlayerClub(userId, club.trim());
    }

    await markOnboarded(userId);
    // `skipped` is the interesting dimension here: it separates people who set
    // themselves up from people who pushed past the screen. No field VALUES are
    // sent — not the club they typed, only whether they typed.
    capture("onboarding_completed", {
      skipped: !save,
      gave_home_club: save && club.trim().length > 0,
    });

    // Is there actually anything to join? A failed read isn't an answer, so
    // Discover gets to say what happened instead of this claiming there's nothing.
    const games = await loadGames().catch(() => null);
    if (games && games.length === 0) {
      setNoGames(true);
      setSaving(false);
      return;
    }

    router.replace("/discover");
  }

  if (loading) {
    return (
      <main className="ios ios-auth">
        <div aria-hidden style={{ paddingTop: "calc(var(--ios-top-gap) + 40px)" }}>
          <div className="ios-skel" style={{ height: 80, margin: "0 16px" }} />
          <div className="ios-skel" style={{ height: 320, margin: "20px 16px 0" }} />
        </div>
      </main>
    );
  }

  if (noGames) {
    return (
      <main className="ios ios-auth">
        <header className="ios-welcome-head">
          <h1 className="ios-lt">You’re All Set</h1>
        </header>
        <div className="ios-card ios-sh" style={{ marginTop: 14, padding: 16 }}>
          There are no games to join right now. Post the first one and share the link with your group, and the spots
          will fill from there.
        </div>
        <div style={{ display: "flex", margin: "16px 16px 0" }}>
          <Link href="/create" className="ios-wide-btn ios-link" data-tone="fill">
            Post a Game
          </Link>
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/discover" className="ios-cl ios-acc ios-md ios-link">
            Look Around First
          </Link>
        </div>
      </main>
    );
  }

  const firstName = name.trim().split(/\s+/)[0];

  return (
    <main className="ios ios-auth">
      <header className="ios-welcome-head">
        <h1 className="ios-lt">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
        <p className="ios-sh ios-sec" style={{ marginTop: 2 }}>
          Two quick things and we’ll show you games to join.
        </p>
      </header>

      <div className="ios-sect" style={{ marginTop: 18 }}>
        <h2 className="ios-t3">Your Level</h2>
      </div>
      <SkillLevelPicker value={skill} onChange={setSkill} />
      <div className="ios-fn ios-sec" style={{ padding: "8px 32px 0" }}>
        From your sign-up. Change it if it’s not right.
      </div>

      <div className="ios-sect" style={{ marginTop: 18 }}>
        <h2 className="ios-t3">Where You Play</h2>
      </div>
      <div className="ios-list">
        <label className="ios-row ios-form-row" style={{ "--ios-label-w": "60px" } as React.CSSProperties}>
          <span className="ios-bd">Club</span>
          <input
            className="ios-input"
            type="text"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="Your usual club or area"
            autoComplete="off"
          />
        </label>
      </div>
      <div className="ios-fn ios-sec" style={{ padding: "8px 32px 0" }}>
        Shown on your profile, and filled in for you when you post a game.
      </div>

      {error && (
        <div className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", margin: "16px 16px 0" }}>
        <button
          type="button"
          className="ios-wide-btn"
          data-tone="fill"
          disabled={saving}
          aria-busy={saving || undefined}
          onClick={() => finish(true)}
        >
          {saving ? "Finding Games…" : "Show Me Games"}
        </button>
      </div>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <button type="button" className="ios-text-btn ios-cl ios-acc ios-md" disabled={saving} onClick={() => finish(false)}>
          Skip for Now
        </button>
      </div>
    </main>
  );
}

/* home_club lives on the player profile rather than the older home_area field.
   Kept as a separate call so a failure to set the club never loses the level,
   which matters more. */
async function savePlayerClub(userId: string, club: string) {
  if (!club) return;
  const { error } = await supabase.from("profiles").update({ home_club: club }).eq("id", userId);
  if (error) console.error("Could not save home club:", error.message);
}
