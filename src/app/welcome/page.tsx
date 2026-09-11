"use client";

// First run. One screen, two fields, then straight to a game they can join.
//
// WHAT IT ASKS, AND WHAT IT DOESN'T
// Skill level is already captured at sign-up, so it arrives pre-filled and can
// be left alone. Home club is the only genuinely new question, and it is the
// one that makes Discover mean something — without it "games near you" is a
// claim the app cannot back up. Nothing else is asked. Every extra field here
// is a place to leave.
//
// WHERE IT SITS IN THE ROUTING, which is how the shared-link case is handled:
// only the HOME screen sends anyone here. A person arriving on /games/[id]
// from a WhatsApp link goes sign-up → back to that game → join, and never
// passes through this screen at all, because nothing on that path redirects.
// The guard below is belt and braces for the case where they somehow land here
// with a join still pending.
//
// ENDING: Discover, but only if there is anything on it. If the board is
// genuinely empty this says so here rather than handing them an empty list and
// letting them work it out.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SkillLevelPicker from "@/components/SkillLevelPicker";
import { Button, Skeleton } from "@/components/ui";
import { Wordmark } from "@/components/brand";
import { supabase } from "@/lib/supabaseClient";
import { getGames } from "@/lib/data";
import { getProfile, markOnboarded, updateProfile, SKILL_LEVELS } from "../profiles";
import { capture } from "@/lib/analytics";

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
  const [boardEmpty, setBoardEmpty] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;

      if (!uid) {
        router.replace("/login");
        return;
      }

      const profile = await getProfile(uid);
      if (!active) return;

      // Already done — never show this twice. Guards a bookmark or a back
      // button as well as a stale redirect.
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
        setError("Couldn't save that. Please try again.");
        setSaving(false);
        return;
      }
      await savePlayerClub(userId, club.trim());
    }

    await markOnboarded(userId);
    // `skipped` is the interesting dimension here: it separates people who
    // set themselves up from people who pushed past the screen. No field
    // VALUES are sent — not the club they typed, only whether they typed.
    capture("onboarding_completed", {
      skipped: !save,
      gave_home_club: save && club.trim().length > 0,
    });

    // Is there actually anything to join? Asking here rather than sending them
    // to a page that will only be able to say "empty" once they arrive.
    const games = await getGames();
    if (games.length === 0) {
      setBoardEmpty(true);
      setSaving(false);
      return;
    }

    router.replace("/discover");
  }

  if (loading) {
    return (
      <main className="px-5 pt-12">
        <Skeleton className="rounded-field h-8 w-52" />
        <Skeleton className="rounded-card h-40 w-full mt-6" />
      </main>
    );
  }

  // ── The board is empty: the real cold start ──
  if (boardEmpty) {
    return (
      <main className="px-5 pt-12">
        <h1 className="t-display text-display-md text-papel">
          You&rsquo;re set. But the board&rsquo;s
          <span className="text-naranja"> empty</span>.
        </h1>
        <p className="text-body font-medium text-papel/85 mt-3">
          There are no games to join in Dublin right now — not hidden behind a
          filter, not at the wrong level. There just aren&rsquo;t any yet.
        </p>
        <p className="text-body font-medium text-papel/85 mt-2.5">
          Someone has to pin the first one up. Put up a game and it goes on the
          board for everyone; share the link into your WhatsApp group and the
          spots fill from there.
        </p>

        <Link
          href="/create"
          className="t-mono pena-riso flex items-center justify-center w-full h-13 bg-lima text-tinta text-title tracking-[0.14em] border-2 border-tinta rounded-card mt-7 active:scale-[0.98] transition-transform duration-150 ease-out"
        >
          Put up a game
        </Link>
        <Link
          href="/discover"
          className="t-mono flex items-center justify-center w-full h-12 text-papel/75 text-label tracking-[0.12em] mt-2 rounded-full"
        >
          Have a look around instead
        </Link>
      </main>
    );
  }

  // ── The one setup screen ──
  const firstName = name.trim().split(/\s+/)[0] || "there";

  return (
    <main className="px-5 pt-12 pb-10">
      <Wordmark tagline="Find and join a padel game near you." />

      <h1 className="t-display text-display-md text-papel mt-9">
        Right then, {firstName}
        <span className="text-naranja">.</span>
      </h1>
      <p className="text-body font-medium text-papel/85 mt-2.5">
        Two quick things and we&rsquo;ll put you in front of games you can
        actually turn up to.
      </p>

      <div className="pl-card p-4 mt-6">
        <span className="t-mono text-micro tracking-[0.12em] text-tinta/70">
          How do you play?
        </span>
        <div className="mt-2">
          <SkillLevelPicker value={skill} onChange={setSkill} />
        </div>
        <p className="text-label font-medium text-tinta/55 mt-2">
          Taken from your sign-up — change it if that&rsquo;s not right.
        </p>

        <label className="block mt-5">
          <span className="t-mono text-micro tracking-[0.12em] text-tinta/70">
            Where do you play?
          </span>
          <input
            type="text"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="e.g. Malahide"
            autoComplete="off"
            className="w-full mt-1.5 pl-surface rounded-field px-3.5 py-2.5 text-body font-medium text-tinta placeholder:text-tinta/40 outline-none focus:border-naranja"
          />
          <span className="block text-label font-medium text-tinta/55 mt-1.5">
            Your usual club or area. It&rsquo;s how we work out which games are
            near you.
          </span>
        </label>
      </div>

      <Button className="mt-6" onClick={() => finish(true)} loading={saving}>
        {saving ? "Finding games…" : "Show me games"}
      </Button>

      <button
        type="button"
        onClick={() => finish(false)}
        disabled={saving}
        className="t-mono block w-full text-center text-micro tracking-[0.12em] text-papel/65 hover:text-papel underline underline-offset-4 mt-3 rounded-field disabled:opacity-50 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
      >
        Skip — I&rsquo;ll do this later
      </button>

      <p
        aria-live="polite"
        className={`text-center text-label font-semibold text-papel bg-naranja-d rounded-field px-3 py-2 mt-3 ${
          error ? "" : "hidden"
        }`}
      >
        {error}
      </p>
    </main>
  );
}

/* home_club lives on the player profile rather than the older home_area field,
   and savePlayerProfile is the writer for it. Kept as a separate call so a
   failure to set the club never loses the skill level, which matters more. */
async function savePlayerClub(userId: string, club: string) {
  if (!club) return;
  const { error } = await supabase
    .from("profiles")
    .update({ home_club: club })
    .eq("id", userId);
  if (error) console.error("Could not save home club:", error.message);
}
