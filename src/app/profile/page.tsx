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
    return (
      <main className="px-5 pt-6 relative">
        <p className="text-dim text-sm mt-4">Loading…</p>
      </main>
    );
  }

  const displayName = name || email?.split("@")[0] || "Player";
  const lvl = skill ? levelNum(skill) : null;
  const chipText = skill
    ? `${lvl != null ? `LVL ${lvl.toFixed(1)} · ` : ""}${skill.toUpperCase()}`
    : "UNRATED";

  return (
    <main className="px-5 pt-6 relative">
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      <div className="flex items-center gap-4 mt-3 relative">
        <LoopRing>{initialsFrom(displayName)}</LoopRing>
        <div>
          <div className="font-display font-bold text-[19px] tracking-tight">{displayName}</div>
          <div className="text-xs text-faint font-light mt-1">
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
            <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">Name</span>
            <input
              type="text"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              placeholder="Your name"
              className="w-full mt-1.5 pl-surface rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky/60"
            />
          </label>
          <label className="block mt-3">
            <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">Skill level</span>
            <select
              value={fSkill}
              onChange={(e) => setFSkill(e.target.value)}
              className="w-full mt-1.5 bg-deep border border-white/10 rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky/60"
            >
              {SKILLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block mt-3">
            <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">Home area</span>
            <input
              type="text"
              value={fHome}
              onChange={(e) => setFHome(e.target.value)}
              placeholder="e.g. Malahide"
              className="w-full mt-1.5 pl-surface rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky/60"
            />
          </label>
          <div className="flex gap-2.5 mt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-center bg-vivid text-white font-semibold text-sm rounded-(--radius-btn) py-2.5 pl-cta-shadow active:scale-[0.98] transition-transform disabled:opacity-70"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-2.5 active:scale-[0.98] transition-transform"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-center text-[12px] text-[#d98080] mt-2">
              Couldn&apos;t save. Please try again.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mt-5">
        {[
          ["24", "", "Games"],
          ["58", "%", "Win rate"],
          ["3", "W", "Streak"],
        ].map(([n, suffix, k]) => (
          <div key={k} className="pl-card rounded-[18px] px-2 py-3.5 text-center">
            <div className="font-display font-bold text-[19px]">
              {n}
              {suffix && <span className="text-sky font-light text-[13px]">{suffix}</span>}
            </div>
            <div className="text-[9.5px] tracking-[1.5px] uppercase text-faint mt-1.5">{k}</div>
          </div>
        ))}
      </div>

      <SectionLabel>This week</SectionLabel>
      <div className="pl-surface rounded-(--radius-card) p-4 flex items-center justify-between">
        <div>
          <div className="text-[13.5px] font-medium">2 games played · 1 booked</div>
          <div className="text-[11px] text-faint font-light mt-0.5">
            Keep the loop going — play 1 more for a 4-game week.
          </div>
        </div>
        <MiniLoop />
      </div>

      <SectionLabel>Recent games</SectionLabel>
      <div className="pl-surface rounded-(--radius-card) px-4 py-1.5">
        {RECENT.map((m, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
          >
            <div
              className={`w-8 h-8 rounded-[11px] flex items-center justify-center font-bold text-[13px] shrink-0 border ${
                m.res === "W"
                  ? "bg-[rgba(60,170,110,0.14)] text-[#5fc78f] border-[rgba(60,170,110,0.25)]"
                  : "bg-[rgba(200,80,80,0.10)] text-[#d98080] border-[rgba(200,80,80,0.2)]"
              }`}
            >
              {m.res}
            </div>
            <div className="flex-1 ml-3.5">
              <div className="text-[13.5px] font-medium">{m.venue}</div>
              <div className="text-[11px] text-faint font-light mt-0.5">{m.meta}</div>
            </div>
            <div className="font-display text-[11px] text-pale tracking-[1px]">{m.score}</div>
          </div>
        ))}
      </div>

      {/* Account actions — my games + edit profile + log out, in the design language. */}
      {!editing && (
        <>
          <Link
            href="/notifications"
            className="block w-full text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-3 mt-6 active:scale-[0.98] transition-transform"
          >
            Notifications
          </Link>
          <Link
            href="/my-games"
            className="block w-full text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-3 mt-2 active:scale-[0.98] transition-transform"
          >
            My games
          </Link>
          <button
            type="button"
            onClick={startEdit}
            className="block w-full text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-3 mt-2 active:scale-[0.98] transition-transform"
          >
            Edit profile
          </button>
        </>
      )}
      <button
        type="button"
        onClick={handleLogout}
        className="block w-full text-center bg-transparent text-faint font-medium text-sm py-3 mt-2 active:scale-[0.98] transition-transform"
      >
        Log out
      </button>

      <BottomNav />
    </main>
  );
}
