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
import {
  Button,
  Chip,
  Input,
  SectionLabel,
  Skeleton,
  Textarea,
} from "@/components/ui";
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
import { getPlayerMatchStats, type PlayerMatchStats } from "../../match-results";

// One upcoming-game card. The whole card links to that game's detail page —
// styled to match the cards on "My games" so the app feels consistent.
function UpcomingGameCard({ game, delay = 0 }: { game: Game; delay?: number }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="pl-card pl-press pl-rise block p-4 mb-3 hover:bg-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="text-title font-semibold text-ink">{game.venue}</div>
          <div className="text-label text-ink-secondary mt-1">
            {formatGameTime(game.game_time)}
            {game.location ? <> · {game.location}</> : null}
          </div>
        </div>
        <Chip>{game.skill_level}</Chip>
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

  // The viewed player's match record (confirmed results only).
  const [matchStats, setMatchStats] = useState<PlayerMatchStats>({
    played: 0,
    won: 0,
    lost: 0,
  });

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
      const [{ data: auth }, loadedProfile, upcoming, count, mStats] =
        await Promise.all([
          supabase.auth.getUser(),
          getProfile(playerId),
          getUpcomingGamesFor(playerId),
          getConnectionCount(playerId),
          getPlayerMatchStats(playerId),
        ]);
      if (!active) return;

      const viewerId = auth.user?.id ?? null;
      setProfile(loadedProfile);
      setCurrentUserId(viewerId);
      setIsOwner(viewerId === playerId);
      setGames(upcoming);
      setConnCount(count);
      setMatchStats(mStats);

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
    // Skeletons in the shape of the identity header — avatar, name, stats
    // card — with the shared shimmer.
    return (
      <main className="px-5 pt-6 relative">
        <div className="flex flex-col items-center mt-2">
          <Skeleton className="rounded-pill size-24" />
          <Skeleton className="rounded-field h-8 w-44 mt-4" />
          <Skeleton className="rounded-card h-18 w-full mt-5" />
        </div>
        <BottomNav />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="px-5 pt-6 relative">
        <h1 className="font-display text-display-md text-ink mt-2">
          Player not found
        </h1>
        <p className="text-label text-ink-secondary mt-1">
          This player doesn&rsquo;t have a profile yet.
        </p>
        <Link
          href="/"
          className="inline-block text-accent text-body font-medium mt-4 rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

  // The identity header's stats row, kept as a list of cells. "Played" and
  // "Won" come from confirmed match results (getPlayerMatchStats); a player
  // with no finalised matches simply shows 0 in both, which reads cleanly.
  const stats: { label: string; value: string; href?: string }[] = [
    { label: "Skill", value: profile.skill_level || "Unrated" },
    {
      label: connCount === 1 ? "Connection" : "Connections",
      value: String(connCount),
      href: isOwner ? "/connections" : undefined,
    },
    { label: "Played", value: String(matchStats.played) },
    { label: "Won", value: String(matchStats.won) },
  ];

  return (
    <main className="px-5 pt-6 relative">
      {/* Identity header — the page anchor. Large avatar, the name at the top
          of the type scale, and a single stats row (skill · connections ·
          played). Centred and given the most size/weight so it reads first. */}
      <header className="flex flex-col items-center text-center mt-2 relative">
        <PlayerAvatar
          userId={playerId}
          avatarUrl={shownAvatar}
          name={displayName}
          className="size-24 ring-1 ring-line"
        />
        <h1 className="font-display text-display-md text-ink mt-4 max-w-full truncate">
          {displayName}
        </h1>

        {/* Stats row — one card, divided into equal cells. Hero numbers get
            the serif. The connections cell links to /connections for the owner. */}
        <div className="w-full pl-card mt-5 flex divide-x divide-line">
          {stats.map((s) => {
            const inner = (
              <>
                <div className="font-display text-display-xs text-ink truncate">
                  {s.value}
                </div>
                <div className="text-label text-ink-secondary mt-1">
                  {s.label}
                </div>
              </>
            );
            return s.href ? (
              <Link
                key={s.label}
                href={s.href}
                className="flex-1 min-w-0 px-2 py-3.5 rounded-field active:opacity-70 transition-opacity duration-150 ease-out hover:bg-bone focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
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
          the mutual connection (logged-out visitors are sent to log in first).
          Connect is the visitor view's one primary action; Connected settles
          into the quiet secondary voice. */}
      {!isOwner && (
        <Button
          variant={connected ? "secondary" : "primary"}
          className="mt-5"
          onClick={handleToggleConnect}
          loading={connBusy}
        >
          {connected ? "Connected ✓" : "Connect"}
        </Button>
      )}

      {/* Edit form — owner only, shown while editing. */}
      {editing && (
        <div className="pl-card p-4 mt-4">
          <div className="flex items-center gap-4">
            <PlayerAvatar
              userId={playerId}
              avatarUrl={fAvatarUrl}
              name={fName || displayName}
              className="size-14"
            />
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                loading={uploading}
              >
                {uploading ? "Uploading…" : "Change photo"}
              </Button>
              <p className="text-label text-ink-faint mt-1.5">
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
            <span className="text-label font-medium text-ink-secondary">Display name</span>
            <Input
              type="text"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              placeholder="Your name"
              className="mt-1.5"
            />
          </label>

          <label className="block mt-3">
            <span className="text-label font-medium text-ink-secondary">Skill level</span>
            <select
              value={fSkill}
              onChange={(e) => setFSkill(e.target.value)}
              className="pl-surface w-full mt-1.5 rounded-field px-4 py-3 text-body text-ink outline-none focus:border-accent transition-colors duration-150 ease-out"
            >
              {SKILL_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="block mt-3">
            <span className="text-label font-medium text-ink-secondary">Home club</span>
            <Input
              type="text"
              value={fClub}
              onChange={(e) => setFClub(e.target.value)}
              placeholder="e.g. Malahide Padel Club"
              className="mt-1.5"
            />
          </label>

          <label className="block mt-3">
            <span className="text-label font-medium text-ink-secondary">Bio</span>
            <Textarea
              value={fBio}
              onChange={(e) => setFBio(e.target.value)}
              placeholder="A line or two about your game."
              rows={3}
              className="mt-1.5 resize-none"
            />
          </label>

          <div className="flex gap-2.5 mt-4">
            <Button
              className="flex-1"
              onClick={handleSave}
              loading={saving}
              disabled={uploading}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
          <p
            aria-live="polite"
            className={`text-center text-label text-danger mt-2 ${error ? "" : "hidden"}`}
          >
            {error}
          </p>
        </div>
      )}

      {/* View sections — hidden while the owner is editing so the form is the
          sole focus. Upcoming games first, then About. */}
      {!editing && (
        <>
          <SectionLabel>Upcoming games</SectionLabel>
          {games.length > 0 ? (
            games.map((game, i) => (
              <UpcomingGameCard key={game.id} game={game} delay={Math.min(i, 6) * 50} />
            ))
          ) : (
            <div className="pl-surface rounded-card px-4 py-5 text-center text-label text-ink-secondary">
              {isOwner
                ? "Nothing coming up — your next game is waiting on Discover."
                : `${displayName} has no games coming up.`}
            </div>
          )}

          {/* About — home club, then bio (when set). */}
          <SectionLabel>About</SectionLabel>
          <div className="pl-card p-4">
            <div className="flex items-center gap-2 text-label text-ink-secondary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-ink-faint">
                <path d="M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11Z" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span>{profile.home_club || "No home club set"}</span>
            </div>
            {profile.bio && (
              <p className="text-body text-ink whitespace-pre-line mt-3 pt-3 border-t border-line">
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
          <Button variant="secondary" className="mt-8" onClick={startEdit}>
            Edit profile
          </Button>
          <div className="flex gap-2 mt-2">
            <Link
              href="/connections"
              className="pl-press flex-1 h-12 flex items-center justify-center gap-2 bg-sunken hover:bg-sunken-strong text-ink font-medium text-body rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
                <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
                <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 5.2a3.2 3.2 0 0 1 0 5.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M17.5 14.4c2 .6 3.5 2.4 3.5 4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Connections
              <span className="text-label text-ink-secondary">· {connCount}</span>
            </Link>
            <Link
              href="/profile"
              aria-label="Settings"
              className="pl-press size-12 shrink-0 flex items-center justify-center bg-sunken hover:bg-sunken-strong text-ink rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          <Button variant="destructive" className="mt-2" onClick={handleLogout}>
            Log out
          </Button>
        </>
      )}

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
