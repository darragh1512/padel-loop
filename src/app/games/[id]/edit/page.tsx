"use client";
// Edit-game form. Only the game's creator can reach it (we check the logged-in
// user against games.created_by and bounce everyone else back to the detail
// page). The fields are pre-filled with the game's current values; saving
// writes them back to the game's row in Supabase and returns to the detail
// page, which re-reads fresh data and shows the update.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { GhostButton, PrimaryButton, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { getGame, updateGame } from "../../../games";

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

// The app stores and displays game times in UTC (see formatGameTime), so the
// edit control works in UTC too: we pre-fill it from the stored time's UTC
// parts, and on save we treat what the creator typed as UTC. That keeps the
// time shown on the detail page identical to what they edited.

// ISO timestamp → "YYYY-MM-DDTHH:mm" for a <input type="datetime-local">,
// using the UTC parts of the date.
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

// "YYYY-MM-DDTHH:mm" (read as UTC) → a full ISO timestamp.
function localInputToIso(value: string): string {
  // Appending "Z" makes the browser parse the entered time as UTC.
  const d = new Date(`${value}:00Z`);
  return d.toISOString();
}

export default function EditGamePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // Form fields (pre-filled once the game loads).
  const [venue, setVenue] = useState("");
  const [location, setLocation] = useState("");
  const [gameTime, setGameTime] = useState(""); // datetime-local value
  const [skillLevel, setSkillLevel] =
    useState<(typeof SKILL_LEVELS)[number]>("Intermediate");
  const [maxPlayers, setMaxPlayers] = useState(4);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // Load the game and confirm the logged-in user created it. Anyone who isn't
  // the creator (including logged-out visitors) is sent away — they can't edit.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const game = await getGame(gameId);

      if (!active) return;

      if (!game || !uid || game.created_by !== uid) {
        router.replace(`/games/${gameId}`);
        return;
      }

      setVenue(game.venue);
      setLocation(game.location);
      setGameTime(isoToLocalInput(game.game_time));
      if (SKILL_LEVELS.includes(game.skill_level as (typeof SKILL_LEVELS)[number])) {
        setSkillLevel(game.skill_level as (typeof SKILL_LEVELS)[number]);
      }
      setMaxPlayers(game.max_players);
      setAllowed(true);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [gameId, router]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(false);

    const result = await updateGame(gameId, {
      venue: venue.trim(),
      location: location.trim(),
      game_time: localInputToIso(gameTime),
      skill_level: skillLevel,
      max_players: maxPlayers,
    });

    if ("ok" in result) {
      router.push(`/games/${gameId}`);
      router.refresh(); // make the detail page re-read the updated row
    } else {
      setError(true);
      setSaving(false);
    }
  }

  // While we load + check permissions, show nothing useful (we redirect
  // non-creators), so just render a minimal placeholder.
  if (loading || !allowed) {
    return (
      <main className="px-5 pt-6 relative">
        <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />
        <p className="text-[13px] text-dim font-light mt-2">Loading…</p>
        <BottomNav />
      </main>
    );
  }

  const fieldClass =
    "w-full bg-transparent text-sm font-semibold text-pale outline-none placeholder:text-faint [color-scheme:dark]";

  return (
    <main className="px-5 pt-6 relative">
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      <h1 className="font-display text-xl tracking-tight mt-2 relative">
        <b className="font-bold">Edit</b> <span className="font-light text-sky">a game</span>
      </h1>
      <p className="text-[13px] text-dim font-light mt-1 mb-4">
        Update the details — players see the changes straight away.
      </p>

      <SectionLabel>Where &amp; when</SectionLabel>

      <div className="pl-surface rounded-[17px] px-4 py-3 mb-2.5">
        <label className="block text-[11px] text-faint font-light mb-1">Venue</label>
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g. Malahide Padel Club"
          className={fieldClass}
        />
      </div>

      <div className="pl-surface rounded-[17px] px-4 py-3 mb-2.5">
        <label className="block text-[11px] text-faint font-light mb-1">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Malahide"
          className={fieldClass}
        />
      </div>

      <div className="pl-surface rounded-[17px] px-4 py-3 mb-2.5">
        <label className="block text-[11px] text-faint font-light mb-1">Date &amp; time</label>
        <input
          type="datetime-local"
          value={gameTime}
          onChange={(e) => setGameTime(e.target.value)}
          className={fieldClass}
        />
      </div>

      <SectionLabel>Game setup</SectionLabel>

      <div className="pl-surface flex rounded-(--radius-btn) p-1 mb-2.5">
        {SKILL_LEVELS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSkillLevel(s)}
            className={`flex-1 text-center text-[12.5px] py-2 rounded-[11px] transition-colors ${
              skillLevel === s
                ? "bg-vivid text-white font-semibold shadow-[0_4px_14px_rgba(30,92,255,0.35)]"
                : "text-faint font-medium"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="pl-surface rounded-[17px] px-4 py-3 mb-2.5 flex justify-between items-center">
        <label className="text-[13px] text-dim font-light">Max players</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Fewer players"
            onClick={() => setMaxPlayers((n) => Math.max(2, n - 1))}
            className="w-7 h-7 rounded-full bg-vivid/15 border border-sky/30 text-sky text-lg leading-none flex items-center justify-center active:scale-95 transition-transform"
          >
            −
          </button>
          <span className="text-sm font-semibold text-pale w-4 text-center">{maxPlayers}</span>
          <button
            type="button"
            aria-label="More players"
            onClick={() => setMaxPlayers((n) => Math.min(8, n + 1))}
            className="w-7 h-7 rounded-full bg-vivid/15 border border-sky/30 text-sky text-lg leading-none flex items-center justify-center active:scale-95 transition-transform"
          >
            +
          </button>
        </div>
      </div>

      <div className="h-3" />

      <PrimaryButton onClick={handleSave}>
        {saving ? "Saving…" : "Save changes"}
      </PrimaryButton>
      {error && (
        <p className="text-center text-[12px] text-[#d98080] mt-2">
          Couldn&apos;t save those changes. Please try again.
        </p>
      )}
      <div className="h-2.5" />
      <GhostButton onClick={() => router.push(`/games/${gameId}`)}>Cancel</GhostButton>

      <BottomNav />
    </main>
  );
}
