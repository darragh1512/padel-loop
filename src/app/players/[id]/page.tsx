"use client";
// A player's public profile, at /players/[id]. Anyone can view it: avatar,
// name, skill level, home club, bio, and the games this player has coming up.
//
// If the person viewing IS the player (their logged-in id matches the id in
// the address), they also get an Edit mode to change their name, skill level,
// home club and bio, and to upload an avatar photo.
//
// Like the rest of the app this reads the player client-side using the shared
// Supabase client, so the same auth/env setup applies everywhere.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import PlayerAvatar from "@/components/PlayerAvatar";
import { LevelChip, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import {
  getProfile,
  savePlayerProfile,
  uploadAvatar,
  SKILL_LEVELS,
  type Profile,
} from "../../profiles";
import { formatGameTime, getUpcomingGamesFor, type Game } from "../../games";

// One upcoming-game card. The whole card links to that game's detail page —
// styled to match the cards on "My games" so the app feels consistent.
function UpcomingGameCard({ game, delay = 0 }: { game: Game; delay?: number }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="block pl-card p-[17px] pb-[15px] mb-3 pl-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="font-semibold text-[15.5px]">{game.venue}</div>
          <div className="text-[12.5px] text-dim font-light mt-1">
            {formatGameTime(game.game_time)}
            {game.location ? <> · {game.location}</> : null}
          </div>
        </div>
        <span className="text-[11px] text-sky font-medium bg-vivid/12 px-2.5 py-1 rounded-full whitespace-nowrap">
          {game.skill_level}
        </span>
      </div>
    </Link>
  );
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const playerId = params.id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [games, setGames] = useState<Game[]>([]);

  // Edit-mode state.
  const [editing, setEditing] = useState(false);
  const [fName, setFName] = useState("");
  const [fSkill, setFSkill] = useState<string>(SKILL_LEVELS[0]);
  const [fClub, setFClub] = useState("");
  const [fBio, setFBio] = useState("");
  const [fAvatarUrl, setFAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: auth }, loadedProfile, upcoming] = await Promise.all([
        supabase.auth.getUser(),
        getProfile(playerId),
        getUpcomingGamesFor(playerId),
      ]);
      if (!active) return;

      setProfile(loadedProfile);
      setIsOwner(auth.user?.id === playerId);
      setGames(upcoming);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [playerId]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function startEdit() {
    if (!profile) return;
    setFName(profile.name ?? "");
    setFSkill(profile.skill_level || SKILL_LEVELS[0]);
    setFClub(profile.home_club ?? "");
    setFBio(profile.bio ?? "");
    setFAvatarUrl(profile.avatar_url ?? null);
    setError(null);
    setEditing(true);
  }

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file || uploading) return;

    setUploading(true);
    setError(null);
    const result = await uploadAvatar(playerId, file);
    if ("url" in result) {
      setFAvatarUrl(result.url);
    } else {
      setError("Couldn’t upload that photo. Please try again.");
    }
    setUploading(false);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);

    const result = await savePlayerProfile(playerId, {
      name: fName,
      skill_level: fSkill,
      home_club: fClub,
      bio: fBio,
      avatar_url: fAvatarUrl,
    });

    if ("ok" in result) {
      // Reflect the saved values in the view without a full reload.
      setProfile((prev) => ({
        id: playerId,
        name: fName,
        skill_level: fSkill,
        home_area: prev?.home_area ?? null,
        home_club: fClub,
        bio: fBio,
        avatar_url: fAvatarUrl,
        created_at: prev?.created_at,
      }));
      setEditing(false);
    } else {
      setError("Couldn’t save. Please try again.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="px-5 pt-6 relative">
        <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />
        <p className="text-[13px] text-dim font-light mt-2">Loading…</p>
        <BottomNav />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="px-5 pt-6 relative">
        <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />
        <h1 className="font-display font-bold text-[19px] tracking-tight mt-2">
          Player not found
        </h1>
        <p className="text-[13px] text-dim font-light mt-1">
          This player doesn’t have a profile yet.
        </p>
        <Link
          href="/"
          className="inline-block text-sky text-sm font-medium mt-4"
        >
          ← Back home
        </Link>
        <BottomNav />
      </main>
    );
  }

  const displayName = profile.name || "Player";
  // While editing, preview the avatar the owner has chosen so far.
  const shownAvatar = editing ? fAvatarUrl : profile.avatar_url;

  return (
    <main className="px-5 pt-6 relative">
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      {/* Header: avatar + name + level + home club. */}
      <div className="flex items-center gap-4 mt-3 relative">
        <PlayerAvatar
          userId={playerId}
          avatarUrl={shownAvatar}
          name={displayName}
          className="size-[74px] border-2 border-navy ring-1 ring-sky/30"
        />
        <div className="min-w-0">
          <div className="font-display font-bold text-[19px] tracking-tight truncate">
            {displayName}
          </div>
          <div className="text-xs text-faint font-light mt-1">
            {profile.home_club || "No home club set"}
          </div>
          <div className="mt-2">
            <LevelChip>
              {profile.skill_level
                ? profile.skill_level.toUpperCase()
                : "UNRATED"}
            </LevelChip>
          </div>
        </div>
      </div>

      {/* Edit form — owner only, shown while editing. */}
      {editing && (
        <div className="pl-card p-4 mt-4">
          <div className="flex items-center gap-4">
            <PlayerAvatar
              userId={playerId}
              avatarUrl={fAvatarUrl}
              name={fName || displayName}
              className="size-14 border-2 border-navy"
            />
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-center bg-transparent text-pale font-medium text-[13px] border border-white/15 rounded-(--radius-btn) px-4 py-2 active:scale-[0.98] transition-transform disabled:opacity-70"
              >
                {uploading ? "Uploading…" : "Change photo"}
              </button>
              <p className="text-[10.5px] text-faint font-light mt-1.5">
                JPG or PNG. Replaces your current photo.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePickFile}
              className="hidden"
            />
          </div>

          <label className="block mt-4">
            <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">
              Display name
            </span>
            <input
              type="text"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              placeholder="Your name"
              className="w-full mt-1.5 pl-surface rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky/60"
            />
          </label>

          <label className="block mt-3">
            <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">
              Skill level
            </span>
            <select
              value={fSkill}
              onChange={(e) => setFSkill(e.target.value)}
              className="w-full mt-1.5 bg-deep border border-white/10 rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky/60"
            >
              {SKILL_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="block mt-3">
            <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">
              Home club
            </span>
            <input
              type="text"
              value={fClub}
              onChange={(e) => setFClub(e.target.value)}
              placeholder="e.g. Malahide Padel Club"
              className="w-full mt-1.5 pl-surface rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky/60"
            />
          </label>

          <label className="block mt-3">
            <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">
              Bio
            </span>
            <textarea
              value={fBio}
              onChange={(e) => setFBio(e.target.value)}
              placeholder="A line or two about your game."
              rows={3}
              className="w-full mt-1.5 pl-surface rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky/60 resize-none"
            />
          </label>

          <div className="flex gap-2.5 mt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploading}
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
            <p className="text-center text-[12px] text-[#d98080] mt-2">{error}</p>
          )}
        </div>
      )}

      {/* Bio (view mode) — only shown when there's something to show. */}
      {!editing && profile.bio && (
        <>
          <SectionLabel>About</SectionLabel>
          <div className="pl-surface rounded-(--radius-card) p-4 text-[13.5px] text-pale font-light leading-relaxed whitespace-pre-line">
            {profile.bio}
          </div>
        </>
      )}

      {/* Upcoming games. */}
      <SectionLabel>Upcoming games</SectionLabel>
      {games.length > 0 ? (
        games.map((game, i) => (
          <UpcomingGameCard key={game.id} game={game} delay={i * 40} />
        ))
      ) : (
        <div className="pl-surface rounded-(--radius-card) px-4 py-5 text-center text-[13px] text-faint font-light">
          {isOwner ? "You have" : `${displayName} has`} no upcoming games.
        </div>
      )}

      {/* Owner-only account actions: edit, settings (the older /profile page,
          still home to win-rate etc.), and log out. */}
      {isOwner && !editing && (
        <>
          <button
            type="button"
            onClick={startEdit}
            className="block w-full text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-3 mt-6 active:scale-[0.98] transition-transform"
          >
            Edit profile
          </button>
          <Link
            href="/profile"
            className="block w-full text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-3 mt-2 active:scale-[0.98] transition-transform"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="block w-full text-center bg-transparent text-faint font-medium text-sm py-3 mt-2 active:scale-[0.98] transition-transform"
          >
            Log out
          </button>
        </>
      )}

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
