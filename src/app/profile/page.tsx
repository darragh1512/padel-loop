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
import { LoopRing, MiniLoop } from "@/components/brand";
import { LevelChip, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { getProfile, updateProfile } from "../profiles";

// Static match history — design as-is (no data source yet).
const RECENT = [
  { res: "W", venue: "Malahide Padel Club", meta: "Mon · with Jonny K.", score: "6–3 · 6–4" },
  { res: "W", venue: "Portmarnock S&L", meta: "Sat · with Conor B.", score: "7–5 · 6–4" },
  { res: "L", venue: "Clontarf Padel Centre", meta: "Thu · with Sarah M.", score: "4–6 · 5–7" },
  { res: "W", venue: "Malahide Padel Club", meta: "Tue · with Jonny K.", score: "6–2 · 6–3" },
] as const;

const SKILLS = ["Beginner", "Intermediate", "Advanced"] as const;

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
  const [fSkill, setFSkill] = useState("Beginner");
  const [fHome, setFHome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

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
    setFSkill(skill || "Beginner");
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
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    // Skeleton in the shape of the header — sunken, subtle pulse.
    return (
      <main className="px-5 pt-6 relative">
        <div className="flex items-center gap-4 mt-3">
          <div className="bg-sunken rounded-full size-[74px] animate-pulse" />
          <div className="space-y-2">
            <div className="bg-sunken rounded-(--radius-field) h-6 w-36 animate-pulse" />
            <div className="bg-sunken rounded-(--radius-field) h-4 w-48 animate-pulse" />
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
          <div className="font-display text-[28px] tracking-tight leading-tight text-ink">{displayName}</div>
          <div className="text-[13px] text-ink-secondary mt-1">
            {home || "Set your area"} · In the Loop since May ’26
          </div>
          <div className="mt-2">
            <LevelChip>{chipText}</LevelChip>
          </div>
        </div>
      </div>

      {/* Edit form — appears only while editing, styled in the design language. */}
      {editing && (
        <div className="pl-card p-4 mt-4">
          <label className="block">
            <span className="text-[13px] text-ink-secondary">Name</span>
            <input
              type="text"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              placeholder="Your name"
              className="w-full mt-1.5 pl-surface rounded-(--radius-field) px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-faint outline-none focus:border-accent"
            />
          </label>
          <label className="block mt-3">
            <span className="text-[13px] text-ink-secondary">Skill level</span>
            <select
              value={fSkill}
              onChange={(e) => setFSkill(e.target.value)}
              className="w-full mt-1.5 pl-surface rounded-(--radius-field) px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-accent"
            >
              {SKILLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block mt-3">
            <span className="text-[13px] text-ink-secondary">Home area</span>
            <input
              type="text"
              value={fHome}
              onChange={(e) => setFHome(e.target.value)}
              placeholder="e.g. Malahide"
              className="w-full mt-1.5 pl-surface rounded-(--radius-field) px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-faint outline-none focus:border-accent"
            />
          </label>
          <div className="flex gap-2.5 mt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-12 text-center bg-accent text-white font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-70"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 h-12 text-center bg-sunken text-ink font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-center text-[13px] text-danger mt-2">
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
            <div className="font-display text-[22px] leading-none text-ink">
              {n}
              {suffix && <span className="text-ink-secondary text-[15px]">{suffix}</span>}
            </div>
            <div className="text-[13px] text-ink-secondary mt-1.5">{k}</div>
          </div>
        ))}
      </div>

      <SectionLabel>This week</SectionLabel>
      <div className="pl-card p-4 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-medium text-ink">2 games played · 1 booked</div>
          <div className="text-[13px] text-ink-secondary mt-0.5">
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
            className="flex items-center justify-between py-3 border-b border-line last:border-0"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-[13px] shrink-0 ${
                m.res === "W"
                  ? "bg-accent-soft text-accent"
                  : "bg-sunken text-danger"
              }`}
            >
              {m.res}
            </div>
            <div className="flex-1 ml-3.5">
              <div className="text-[15px] font-medium text-ink">{m.venue}</div>
              <div className="text-[13px] text-ink-secondary mt-0.5">{m.meta}</div>
            </div>
            <div className="font-display text-[15px] text-ink">{m.score}</div>
          </div>
        ))}
      </div>

      {/* Account actions — my games + edit profile + log out, in the design language. */}
      {!editing && (
        <>
          <Link
            href="/notifications"
            className="flex items-center justify-center w-full h-12 bg-sunken text-ink font-medium text-[15px] rounded-full mt-8 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            Notifications
          </Link>
          <Link
            href="/my-games"
            className="flex items-center justify-center w-full h-12 bg-sunken text-ink font-medium text-[15px] rounded-full mt-2 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            My games
          </Link>
          <button
            type="button"
            onClick={startEdit}
            className="block w-full h-12 text-center bg-sunken text-ink font-medium text-[15px] rounded-full mt-2 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            Edit profile
          </button>
        </>
      )}
      <button
        type="button"
        onClick={handleLogout}
        className="block w-full text-center bg-transparent text-danger font-medium text-[15px] py-3 mt-2 active:scale-[0.98] transition-transform duration-150 ease-out"
      >
        Log out
      </button>

      <BottomNav />
    </main>
  );
}
