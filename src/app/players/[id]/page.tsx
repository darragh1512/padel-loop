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
import { SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import {
  getProfile,
  savePlayerProfile,
  uploadAvatar,
  SKILL_LEVELS,
  type Profile,
} from "../../profiles";
import { formatGameTime, getUpcomingGamesFor, type Game } from "../../games";
import {
  areConnected,
  connect,
  disconnect,
  getConnectionCount,
} from "../../connections";

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

  // Connection state. currentUserId is whoever is logged in (null if nobody);
  // connected is whether they're connected to the viewed player; connCount is
  // the viewed player's total connections, shown on the profile.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connCount, setConnCount] = useState(0);
  const [connBusy, setConnBusy] = useState(false);

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
      const [{ data: auth }, loadedProfile, upcoming, count] =
        await Promise.all([
          supabase.auth.getUser(),
          getProfile(playerId),
          getUpcomingGamesFor(playerId),
          getConnectionCount(playerId),
        ]);
      if (!active) return;

      const viewerId = auth.user?.id ?? null;
      setProfile(loadedProfile);
      setCurrentUserId(viewerId);
      setIsOwner(viewerId === playerId);
      setGames(upcoming);
      setConnCount(count);

      // Only the non-owner view needs to know if they're already connected.
      if (viewerId && viewerId !== playerId) {
        const isConn = await areConnected(viewerId, playerId);
        if (!active) return;
        setConnected(isConn);
      }

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

  // Connect when not yet connected, disconnect when already connected. The
  // viewed player's connection count moves with it. Sends logged-out visitors
  // to log in first.
  async function handleToggleConnect() {
    if (!currentUserId) {
      router.push("/login");
      return;
    }
    if (connBusy) return;
    setConnBusy(true);

    if (connected) {
      const result = await disconnect(currentUserId, playerId);
      if ("ok" in result) {
        setConnected(false);
        setConnCount((c) => Math.max(0, c - 1));
      }
    } else {
      const result = await connect(currentUserId, playerId);
      if ("ok" in result) {
        setConnected(true);
        setConnCount((c) => c + 1);
      }
    }

    setConnBusy(false);
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

  // The identity header's stats row. Kept as a list so another stat (e.g. a
  // wins/rating stat) can slot straight in once match results exist. "Played"
  // is a placeholder for now — there's no match-history data yet, so it shows
  // a dash rather than a fabricated number.
  const stats: { label: string; value: string; href?: string }[] = [
    { label: "Skill", value: profile.skill_level || "Unrated" },
    {
      label: connCount === 1 ? "Connection" : "Connections",
      value: String(connCount),
      href: isOwner ? "/connections" : undefined,
    },
    { label: "Played", value: "—" },
  ];

  return (
    <main className="px-5 pt-6 relative">
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      {/* Identity header — the page anchor. Large avatar, the name at the top
          of the type scale, and a single stats row (skill · connections ·
          played). Centred and given the most size/weight so it reads first. */}
      <header className="flex flex-col items-center text-center mt-2 relative">
        <PlayerAvatar
          userId={playerId}
          avatarUrl={shownAvatar}
          name={displayName}
          className="size-24 border-2 border-navy ring-2 ring-sky/40"
        />
        <h1 className="font-display font-bold text-[24px] tracking-tight mt-3.5 max-w-full truncate">
          {displayName}
        </h1>

        {/* Stats row — one bar, divided into equal cells. The connections cell
            links through to /connections for the owner. */}
        <div className="w-full pl-surface rounded-(--radius-card) mt-4 flex divide-x divide-white/8">
          {stats.map((s) => {
            const inner = (
              <>
                <div className="font-display font-bold text-[15px] leading-tight truncate">
                  {s.value}
                </div>
                <div className="text-[9px] tracking-[1.5px] uppercase text-faint mt-1">
                  {s.label}
                </div>
              </>
            );
            return s.href ? (
              <Link
                key={s.label}
                href={s.href}
                className="flex-1 min-w-0 px-2 py-3.5 active:opacity-70 transition-opacity"
              >
                {inner}
              </Link>
            ) : (
              <div key={s.label} className="flex-1 min-w-0 px-2 py-3.5">
                {inner}
              </div>
            );
          })}
        </div>
      </header>

      {/* Connect / Connected — only on someone else's profile. Tapping toggles
          the mutual connection (logged-out visitors are sent to log in first). */}
      {!isOwner && (
        <button
          type="button"
          onClick={handleToggleConnect}
          disabled={connBusy}
          aria-label={connected ? "Disconnect" : "Connect"}
          className={
            connected
              ? "block w-full text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-3 mt-5 active:scale-[0.98] transition-transform disabled:opacity-70"
              : "block w-full text-center bg-vivid text-white font-semibold text-sm rounded-(--radius-btn) py-3 mt-5 pl-cta-shadow active:scale-[0.98] transition-transform disabled:opacity-70"
          }
        >
          {connBusy
            ? connected
              ? "Disconnecting…"
              : "Connecting…"
            : connected
              ? "Connected ✓"
              : "Connect"}
        </button>
      )}

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

      {/* View sections — hidden while the owner is editing so the form is the
          sole focus. Upcoming games first, then About. */}
      {!editing && (
        <>
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

          {/* About — home club, then bio (when set). */}
          <SectionLabel>About</SectionLabel>
          <div className="pl-surface rounded-(--radius-card) p-4">
            <div className="flex items-center gap-2 text-[13px] text-dim">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-sky">
                <path d="M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11Z" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span>{profile.home_club || "No home club set"}</span>
            </div>
            {profile.bio && (
              <p className="text-[13.5px] text-pale font-light leading-relaxed whitespace-pre-line mt-3 pt-3 border-t border-white/8">
                {profile.bio}
              </p>
            )}
          </div>
        </>
      )}

      {/* Owner-only account actions: edit, the connections hub + settings gear
          (the older /profile page, still home to win-rate etc.), and log out.
          Connections lives here now that it's no longer a bottom-nav tab. */}
      {isOwner && !editing && (
        <>
          <button
            type="button"
            onClick={startEdit}
            className="block w-full text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-3 mt-6 active:scale-[0.98] transition-transform"
          >
            Edit profile
          </button>
          <div className="flex gap-2 mt-2">
            <Link
              href="/connections"
              className="flex-1 flex items-center justify-center gap-2 bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-3 active:scale-[0.98] transition-transform"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
                <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 5.2a3.2 3.2 0 0 1 0 5.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M17.5 14.4c2 .6 3.5 2.4 3.5 4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Connections
              <span className="text-[11px] font-semibold text-sky bg-vivid/15 border border-sky/25 rounded-full px-2 py-0.5">
                {connCount}
              </span>
            </Link>
            <Link
              href="/profile"
              aria-label="Settings"
              className="w-12 shrink-0 flex items-center justify-center bg-transparent text-pale border border-white/15 rounded-(--radius-btn) active:scale-[0.98] transition-transform"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
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
