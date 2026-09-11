"use client";
// The profile screen. Visual design is unchanged from the approved mock — the
// header, stats, "this week" and "recent games" all keep their exact styling.
// What's added is behaviour: it loads the logged-in person's real profile,
// lets them edit name / skill level / home area (saved to Supabase), and log
// out. Logged-out visitors are sent to the login page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import BlockedList from "./blocked-list";
import { resetAnalytics } from "@/lib/analytics";
import { LoopRing, MiniLoop } from "@/components/brand";
import { LevelChip, SectionLabel } from "@/components/ui";
import SkillLevelPicker from "@/components/SkillLevelPicker";
import { supabase } from "@/lib/supabaseClient";
import {
  deleteMyAccount,
  getProfile,
  updateProfile,
  SKILL_LEVELS,
} from "../profiles";
import { Button, Dialog } from "@/components/ui";

// Static match history — design as-is (no data source yet).
const RECENT = [
  { res: "W", venue: "Malahide Padel Club", meta: "Mon · with Jonny K.", score: "6–3 · 6–4" },
  { res: "W", venue: "Portmarnock S&L", meta: "Sat · with Conor B.", score: "7–5 · 6–4" },
  { res: "L", venue: "Clontarf Padel Centre", meta: "Thu · with Sarah M.", score: "4–6 · 5–7" },
  { res: "W", venue: "Malahide Padel Club", meta: "Tue · with Jonny K.", score: "6–2 · 6–3" },
] as const;

// Text skill → a single numeric level for the "LVL x.x" chip.
function levelNum(skill: string): number | null {
  switch (skill.toLowerCase()) {
    case "beginner":
      return 1.8;
    case "intermediate":
      return 3.0;
    case "advanced":
      return 4.2;
    default:
      return null;
  }
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  const letters = (parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? "");
  return letters.toUpperCase() || "P";
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // The saved profile (what's shown).
  const [name, setName] = useState("");
  const [skill, setSkill] = useState("");
  const [home, setHome] = useState("");

  // Edit form state.
  const [editing, setEditing] = useState(false);
  const [fName, setFName] = useState("");
  const [fSkill, setFSkill] = useState<string>(SKILL_LEVELS[0]);
  const [fHome, setFHome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // Deleting the account. The typed confirmation is the point: this is the
  // one action in the app that cannot be undone by any means, so it must not
  // be reachable by a mis-tap.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? null);

      const profile = await getProfile(data.user.id);
      if (profile) {
        setName(profile.name ?? "");
        setSkill(profile.skill_level ?? "");
        setHome(profile.home_area ?? "");
      }
      setLoading(false);
    }
    load();
  }, [router]);

  function startEdit() {
    setFName(name);
    setFSkill(skill || SKILL_LEVELS[0]);
    setFHome(home);
    setError(false);
    setEditing(true);
  }

  async function handleSave() {
    if (!userId || saving) return;
    setSaving(true);
    setError(false);

    const result = await updateProfile(userId, {
      name: fName,
      skill_level: fSkill,
      home_area: fHome,
    });

    if ("ok" in result) {
      setName(fName);
      setSkill(fSkill);
      setHome(fHome);
      setEditing(false);
    } else {
      setError(true);
    }
    setSaving(false);
  }

  async function handleLogout() {
    // Stop attributing this device to them — the next person to sign in
    // on a shared phone must not be counted as the same person.
    resetAnalytics();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);

    const result = await deleteMyAccount();

    if ("ok" in result) {
      // Everything happened in one transaction and the session is already
      // signed out. A hard navigation rather than router.push, so no stale
      // client state survives for an account that no longer exists.
      window.location.href = "/";
      return;
    }

    // Nothing was deleted — the whole function rolled back — so they still
    // have a working account and can simply try again.
    setDeleteError(
      "Couldn't delete your account. Nothing was changed — please try again.",
    );
    setDeleting(false);
  }

  if (loading) {
    // Skeleton in the shape of the header — papel ghosts on the wall.
    return (
      <main className="px-5 pt-6 relative">
        <div className="flex items-center gap-4 mt-3">
          <div className="rounded-full size-[74px] pl-skeleton" />
          <div className="space-y-2">
            <div className="rounded-field h-6 w-36 pl-skeleton" />
            <div className="rounded-field h-4 w-48 pl-skeleton" />
          </div>
        </div>
      </main>
    );
  }

  const displayName = name || email?.split("@")[0] || "Player";
  const lvl = skill ? levelNum(skill) : null;
  const chipText = skill
    ? `${lvl != null ? `Level ${lvl.toFixed(1)} · ` : ""}${skill}`
    : "Unrated";

  return (
    <main className="px-5 pt-6 relative">
      <div className="flex items-center gap-4 mt-3 relative">
        <LoopRing>{initialsFrom(displayName)}</LoopRing>
        <div>
          <div className="t-display text-display-md text-papel">{displayName}</div>
          <div className="t-mono text-[9px] tracking-[0.14em] text-papel/80 mt-1.5">
            {home || "Set your area"} · In the Loop since May ’26
          </div>
          <div className="mt-2.5">
            <LevelChip>{chipText}</LevelChip>
          </div>
        </div>
      </div>

      {/* Edit form — appears only while editing, styled in the design language. */}
      {editing && (
        <div className="pl-card p-4 mt-4">
          <label className="block">
            <span className="t-mono text-micro tracking-[0.12em] text-tinta/70">Name</span>
            <input
              type="text"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              placeholder="Your name"
              className="w-full mt-1.5 pl-surface rounded-field px-3.5 py-2.5 text-body font-medium text-tinta placeholder:text-tinta/45 outline-none focus:border-naranja"
            />
          </label>
          <div className="mt-3">
            <span className="t-mono text-micro tracking-[0.12em] text-tinta/70">Skill level</span>
            <div className="mt-1.5">
              <SkillLevelPicker value={fSkill} onChange={setFSkill} />
            </div>
          </div>
          <label className="block mt-3">
            <span className="t-mono text-micro tracking-[0.12em] text-tinta/70">Home area</span>
            <input
              type="text"
              value={fHome}
              onChange={(e) => setFHome(e.target.value)}
              placeholder="e.g. Malahide"
              className="w-full mt-1.5 pl-surface rounded-field px-3.5 py-2.5 text-body font-medium text-tinta placeholder:text-tinta/45 outline-none focus:border-naranja"
            />
          </label>
          <div className="flex gap-2.5 mt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="t-mono flex-1 h-12 text-center bg-lima text-tinta text-label tracking-[0.12em] border-2 border-tinta pena-riso rounded-full active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-70"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="t-mono flex-1 h-12 text-center bg-papel text-tinta text-label tracking-[0.12em] border-2 border-tinta rounded-full active:scale-[0.98] transition-transform duration-150 ease-out"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-center text-label font-semibold text-naranja-d mt-2">
              Couldn&apos;t save. Please try again.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mt-6">
        {[
          ["24", "", "Games"],
          ["58", "%", "Win rate"],
          ["3", "W", "Streak"],
        ].map(([n, suffix, k]) => (
          <div key={k} className="pl-card px-2 py-3.5 text-center">
            <div className="t-display text-display-sm leading-none text-tinta">
              {n}
              {suffix && <span className="text-tinta/70 text-body">{suffix}</span>}
            </div>
            <div className="t-mono text-[9px] tracking-[0.1em] text-naranja-d mt-1.5">{k}</div>
          </div>
        ))}
      </div>

      <SectionLabel>This week</SectionLabel>
      <div className="pl-card p-4 flex items-center justify-between">
        <div>
          <div className="text-body font-extrabold text-tinta">2 games played · 1 booked</div>
          <div className="text-label font-medium text-tinta/70 mt-0.5">
            Keep the loop going — play 1 more for a 4-game week.
          </div>
        </div>
        <MiniLoop />
      </div>

      <SectionLabel>Recent games</SectionLabel>
      <div className="pl-card px-4 py-1.5">
        {RECENT.map((m, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-3 border-b border-tinta/15 last:border-0"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-label shrink-0 border-[1.5px] ${
                m.res === "W"
                  ? "bg-lima text-tinta border-tinta"
                  : "bg-papel text-naranja-d border-dashed border-naranja-d"
              }`}
            >
              {m.res}
            </div>
            <div className="flex-1 ml-3.5">
              <div className="text-body font-extrabold text-tinta">{m.venue}</div>
              <div className="t-mono text-[9px] tracking-[0.1em] text-tinta/70 mt-0.5">{m.meta}</div>
            </div>
            <div className="t-mono text-label text-tinta">{m.score}</div>
          </div>
        ))}
      </div>

      {/* The written-down bits. Text lives in content/*.md. */}
      <div className="flex gap-2 mt-8">
        <Link
          href="/terms"
          className="t-mono flex-1 flex items-center justify-center h-11 bg-papel text-tinta text-micro tracking-[0.12em] border-2 border-tinta rounded-full active:scale-[0.98] transition-transform duration-150 ease-out"
        >
          Terms
        </Link>
        <Link
          href="/privacy"
          className="t-mono flex-1 flex items-center justify-center h-11 bg-papel text-tinta text-micro tracking-[0.12em] border-2 border-tinta rounded-full active:scale-[0.98] transition-transform duration-150 ease-out"
        >
          Privacy
        </Link>
      </div>

      {/* Manage and unblock. Renders nothing when nobody is blocked. */}
      <BlockedList userId={userId} />

      {/* Account actions — my games + edit profile + log out, in the design language. */}
      {!editing && (
        <>
          <Link
            href="/notifications"
            className="t-mono flex items-center justify-center w-full h-12 bg-papel text-tinta text-label tracking-[0.12em] border-2 border-tinta rounded-full mt-8 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            Notifications
          </Link>
          <Link
            href="/my-games"
            className="t-mono flex items-center justify-center w-full h-12 bg-papel text-tinta text-label tracking-[0.12em] border-2 border-tinta rounded-full mt-2 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            My games
          </Link>
          <button
            type="button"
            onClick={startEdit}
            className="t-mono block w-full h-12 text-center bg-papel text-tinta text-label tracking-[0.12em] border-2 border-tinta rounded-full mt-2 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            Edit profile
          </button>
        </>
      )}
      <button
        type="button"
        onClick={handleLogout}
        className={`t-mono block w-full h-12 text-center bg-papel text-naranja-d text-label tracking-[0.12em] border-2 border-dashed border-naranja-d rounded-full ${editing ? "mt-8" : "mt-2"} active:scale-[0.98] transition-transform duration-150 ease-out`}
      >
        Log out
      </button>

      {/* The one irreversible action in the app. Quiet, last, and behind a
          typed confirmation. */}
      <button
        type="button"
        onClick={() => {
          setDeleteText("");
          setDeleteError(null);
          setConfirmingDelete(true);
        }}
        className="t-mono block w-full text-center text-micro tracking-[0.12em] text-papel/60 hover:text-papel/90 underline underline-offset-4 mt-8 rounded-field transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
      >
        Delete my account
      </button>

      <Dialog
        open={confirmingDelete}
        onClose={() => !deleting && setConfirmingDelete(false)}
        title="Delete your account?"
      >
        <p className="text-label font-medium text-tinta/70 mt-2">
          This cannot be undone.
        </p>

        <p className="t-mono text-micro tracking-[0.12em] text-tinta/70 mt-3">
          Deleted for good
        </p>
        <ul className="text-label font-medium text-tinta/70 mt-1 space-y-0.5 list-disc pl-4">
          <li>Your login, name, photo and profile</li>
          <li>Your chat messages</li>
          <li>Your connections and notifications</li>
          <li>Your place in any game or waiting list</li>
        </ul>

        <p className="t-mono text-micro tracking-[0.12em] text-tinta/70 mt-3">
          Kept, with your name removed
        </p>
        <ul className="text-label font-medium text-tinta/70 mt-1 space-y-0.5 list-disc pl-4">
          <li>
            Match results you played in — they are the other three players&rsquo;
            record too, so they stay, showing you only as a past player
          </li>
          <li>
            Games you organised that others joined — handed to another player
            so the game still goes ahead
          </li>
        </ul>

        <label className="block mt-4">
          <span className="text-label font-medium text-tinta/70">
            Type <span className="font-extrabold text-tinta">DELETE</span> to
            confirm
          </span>
          <input
            type="text"
            value={deleteText}
            onChange={(e) => setDeleteText(e.target.value)}
            placeholder="DELETE"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full mt-1.5 pl-surface rounded-field px-3.5 py-2.5 text-body font-medium text-tinta placeholder:text-tinta/35 outline-none focus:border-naranja"
          />
        </label>

        <div className="flex gap-2.5 mt-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setConfirmingDelete(false)}
            disabled={deleting}
          >
            Keep my account
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDeleteAccount}
            loading={deleting}
            disabled={deleteText.trim().toUpperCase() !== "DELETE"}
          >
            Delete
          </Button>
        </div>

        <p
          aria-live="polite"
          className={`text-center text-label font-semibold text-naranja-d mt-3 ${
            deleteError ? "" : "hidden"
          }`}
        >
          {deleteError}
        </p>
      </Dialog>

      <BottomNav />
    </main>
  );
}
