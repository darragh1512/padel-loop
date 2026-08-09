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
import { dublinToUtc, utcToDublinInput } from "@/lib/time";
import { getGame, updateGame } from "../../../games";

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

// Game times are stored as true UTC instants but shown and typed as
// Europe/Dublin wall-clock times everywhere (see src/lib/time.ts). The edit
// control follows suit: pre-fill it with the stored instant's Dublin reading,
// and on save treat what the creator typed as Dublin time.

// "YYYY-MM-DDTHH:mm" (typed as Dublin wall clock) → a true-UTC ISO timestamp.
function dublinInputToIso(value: string): string {
  const [date, time] = value.split("T");
  return dublinToUtc(date, time);
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
      setGameTime(utcToDublinInput(game.game_time));
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
      game_time: dublinInputToIso(gameTime),
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
    // Skeletons in the shape of the form — sunken, subtle pulse.
    return (
      <main className="px-5 pt-6 relative">
        <div className="rounded-field h-9 w-44 mt-2 pl-skeleton" />
        <div className="mt-8 space-y-2.5">
          <div className="rounded-field h-[60px] pl-skeleton" />
          <div className="rounded-field h-[60px] pl-skeleton" />
          <div className="rounded-field h-[60px] pl-skeleton" />
        </div>
        <BottomNav />
      </main>
    );
  }

  const fieldClass =
    "w-full bg-transparent text-body font-semibold text-tinta outline-none placeholder:text-tinta/45 placeholder:font-normal [color-scheme:light]";

  return (
    <main className="px-5 pt-6 relative">
      <p className="t-mono text-micro text-papel/80 mt-2">Fix the poster</p>
      <h1 className="t-display text-display-md text-papel mt-1.5 relative">
        Edit a game
      </h1>
      <p className="text-label font-medium text-papel/85 mt-1.5 mb-4">
        Update the details — players see the changes straight away.
      </p>

      <SectionLabel>Where &amp; when</SectionLabel>

      <div className="pl-surface rounded-field px-4 py-3 mb-2.5 focus-within:border-naranja">
        <label className="t-mono block text-micro tracking-[0.12em] text-tinta/70 mb-1">Venue</label>
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g. Malahide Padel Club"
          className={fieldClass}
        />
      </div>

      <div className="pl-surface rounded-field px-4 py-3 mb-2.5 focus-within:border-naranja">
        <label className="t-mono block text-micro tracking-[0.12em] text-tinta/70 mb-1">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Malahide"
          className={fieldClass}
        />
      </div>

      <div className="pl-surface rounded-field px-4 py-3 mb-2.5 focus-within:border-naranja">
        <label className="t-mono block text-micro tracking-[0.12em] text-tinta/70 mb-1">Date &amp; time</label>
        <input
          type="datetime-local"
          value={gameTime}
          onChange={(e) => setGameTime(e.target.value)}
          className={fieldClass}
        />
      </div>

      <SectionLabel>Game setup</SectionLabel>

      <div className="pl-surface flex rounded-full p-1 mb-2.5">
        {SKILL_LEVELS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSkillLevel(s)}
            className={`flex-1 text-center text-label py-2 rounded-full transition-colors duration-150 ease-out ${
              skillLevel === s
                ? "bg-lima text-tinta font-extrabold border-[1.5px] border-tinta"
                : "text-tinta/70 font-semibold border-[1.5px] border-transparent"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="pl-surface rounded-field px-4 py-3 mb-2.5 flex justify-between items-center">
        <label className="t-mono text-micro tracking-[0.12em] text-tinta/70">Max players</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Fewer players"
            onClick={() => setMaxPlayers((n) => Math.max(2, n - 1))}
            className="w-7 h-7 rounded-full bg-papel border-[1.5px] border-tinta text-tinta text-lg leading-none flex items-center justify-center active:scale-95 transition-transform duration-150 ease-out"
          >
            −
          </button>
          <span className="text-body font-extrabold text-tinta w-4 text-center">{maxPlayers}</span>
          <button
            type="button"
            aria-label="More players"
            onClick={() => setMaxPlayers((n) => Math.min(8, n + 1))}
            className="w-7 h-7 rounded-full bg-lima border-[1.5px] border-tinta text-tinta text-lg leading-none flex items-center justify-center active:scale-95 transition-transform duration-150 ease-out"
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
        <p className="text-center text-label font-semibold text-papel bg-naranja-d rounded-field px-3 py-1.5 mt-2">
          Couldn&apos;t save those changes. Please try again.
        </p>
      )}
      <div className="h-2.5" />
      <GhostButton onClick={() => router.push(`/games/${gameId}`)}>Cancel</GhostButton>

      <BottomNav />
    </main>
  );
}
