"use client";
// A player's public profile, at /players/[id]. Anyone can view it: avatar,
// name, skill level, home club, form, badges and the games they have coming up.
//
// If the person viewing IS the player (their logged-in id matches the id in
// the address), they also get an Edit mode to change their name, skill level,
// home club and bio, and to upload an avatar photo.
//
// Layout follows the prototype: an identity band on the wall (avatar, name,
// chips, quick actions), one stats poster, and a three-way segmented control
// — Overview · Badges · Code — over a scrolling body.
//
// Like the rest of the app this reads the player client-side using the shared
// Supabase client, so the same auth/env setup applies everywhere.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import PlayerAvatar from "@/components/PlayerAvatar";
import PlayerQRCode from "@/components/PlayerQRCode";
import QRScanner from "@/components/QRScanner";
import SkillLevelPicker from "@/components/SkillLevelPicker";
import { Button, Input, Skeleton, Textarea } from "@/components/ui";
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
import {
  getPlayerMatchStats,
  getPlayerResultHistory,
  type PlayerMatchStats,
  type PlayerResultOutcome,
} from "../../match-results";
import { computeBadges, longestWinStreak, type BadgeProgress } from "../../badges";

/* ── Small printed parts, straight from the prototype ─────────────────────*/

// The section rule: a tracked-out mono label with an ink hairline running to
// the edge of the board.
function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mx-0.5 mb-2.5 mt-4">
      <span className="t-mono text-tiny tracking-[0.2em] text-papel/72 whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-0.5 bg-papel/18" />
    </div>
  );
}

// A progress bar: ink-outlined pill, lima fill.
function Bar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <span
      className={`block border-2 border-tinta rounded-pill overflow-hidden bg-tinta/10 ${className}`}
    >
      <span
        className="block h-full bg-lima"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  );
}

// One upcoming game, in the prototype's result-row shape: a coloured rail, a
// round stamp, the venue in poster caps, and the when/where in printed mono.
function UpcomingGameRow({ game }: { game: Game }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="pl-card pl-press relative flex items-center gap-3 py-2.5 pr-3.5 pl-4 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
    >
      <span className="absolute left-0 inset-y-0 w-1.5 bg-lima" aria-hidden />
      <span className="flex-none size-7.5 rounded-pill grid place-items-center border-2 border-tinta bg-lima">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden>
          <path
            d="M4.5 6.5h15v13h-15zM8 4v4M16 4v4M4.5 11h15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="t-display block text-[0.875rem] text-tinta truncate">
          {game.venue}
        </span>
        <span className="t-eyebrow block text-tiny tracking-[0.06em] text-tinta/55 mt-0.5 truncate">
          {formatGameTime(game.game_time)}
          {game.location ? ` · ${game.location}` : ""}
        </span>
      </span>
      <span className="t-mono flex-none text-tiny text-tinta bg-lima border-2 border-tinta rounded-stamp px-1.5 py-1">
        {game.skill_level}
      </span>
    </Link>
  );
}

// Pull a player id out of a scanned code. Only accepts our own profile URL
// shape (any origin — we never navigate to the scanned URL itself, just lift
// the id and route to it inside this app).
function extractPlayerId(scanned: string): string | null {
  try {
    const parsed = new URL(scanned);
    const match = parsed.pathname.match(/^\/players\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

type Tab = "Overview" | "Badges" | "Code";

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const playerId = params.id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [tab, setTab] = useState<Tab>("Overview");

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

  // Their confirmed result history, oldest first. One query feeds both the
  // form strip and the best-streak badge input.
  const [history, setHistory] = useState<PlayerResultOutcome[]>([]);

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

  // "My code" panel — owner only. QR encodes the full profile URL, so it
  // needs the browser's origin (not available during server rendering).
  const [origin, setOrigin] = useState("");
  const [qrPanel, setQrPanel] = useState<"code" | "scan">("code");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0); // bumped to restart the camera after a bad scan

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: auth }, loadedProfile, upcoming, count, mStats, hist] =
        await Promise.all([
          supabase.auth.getUser(),
          getProfile(playerId),
          getUpcomingGamesFor(playerId),
          getConnectionCount(playerId),
          getPlayerMatchStats(playerId),
          getPlayerResultHistory(playerId),
        ]);
      if (!active) return;

      const viewerId = auth.user?.id ?? null;
      setProfile(loadedProfile);
      setCurrentUserId(viewerId);
      setIsOwner(viewerId === playerId);
      setGames(upcoming);
      setConnCount(count);
      setMatchStats(mStats);
      setHistory(hist);

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

  function handleScan(text: string) {
    const id = extractPlayerId(text);
    if (id) {
      router.push(`/players/${id}`);
      return;
    }
    setScanError("That doesn't look like a Padel Loop player code.");
  }

  function retryScan() {
    setScanError(null);
    setScanKey((k) => k + 1); // remounts QRScanner, which restarts the camera
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

  // The last eight confirmed results, newest last — the form strip. The run of
  // wins at the end of that history is the CURRENT streak (distinct from the
  // best-ever streak the badges use).
  const form = useMemo(() => history.slice(-8), [history]);
  const currentStreak = useMemo(() => {
    let run = 0;
    for (let i = history.length - 1; i >= 0 && history[i].won; i--) run++;
    return run;
  }, [history]);
  const bestStreak = useMemo(() => longestWinStreak(history), [history]);

  const badges: BadgeProgress[] = useMemo(
    () =>
      computeBadges({
        connections: connCount,
        gamesPlayed: matchStats.played,
        bestStreak,
      }),
    [connCount, matchStats.played, bestStreak],
  );

  if (loading) {
    // Skeletons in the shape of the identity band — avatar, name, stats card.
    return (
      <main className="px-5 pt-4 relative">
        <div className="flex items-center gap-3.5">
          <Skeleton className="rounded-pill size-16 flex-none" />
          <div className="flex-1">
            <Skeleton className="rounded-field h-7 w-40" />
            <Skeleton className="rounded-pill h-5 w-28 mt-2" />
          </div>
        </div>
        <Skeleton className="rounded-card h-16 w-full mt-3.5" />
        <Skeleton className="rounded-card h-9 w-full mt-3" />
        <BottomNav />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="px-5 pt-6 relative">
        <h1 className="t-display text-display-md text-papel mt-2">
          Player not found
        </h1>
        <p className="text-body font-medium text-papel/85 mt-1.5">
          This player doesn&rsquo;t have a profile yet.
        </p>
        <Link
          href="/"
          className="t-mono inline-block text-lima text-body mt-4 rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
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

  // The stats poster. "Rating" is the EARNED number (Elo-style, moved only by
  // confirmed results — the database owns it) and takes the accent. "Played"
  // and "Won" come from confirmed match results; "Mates" is the connection
  // count, which links to /connections for the owner.
  const stats: {
    label: string;
    value: string;
    href?: string;
    accent?: boolean;
  }[] = [
    {
      label: "Rating",
      value: profile.rating != null ? String(profile.rating) : "—",
      accent: true,
    },
    { label: "Played", value: String(matchStats.played) },
    { label: "Won", value: String(matchStats.won) },
    {
      label: "Mates",
      value: String(connCount),
      href: isOwner ? "/connections" : undefined,
    },
  ];

  return (
    <main className="px-5 pt-4 relative">
      {/* ── Identity band ────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3.5">
        <PlayerAvatar
          userId={playerId}
          avatarUrl={shownAvatar}
          name={displayName}
          className="size-16 flex-none border-2 border-tinta shadow-[4px_4px_0_rgb(6_20_58/0.4)]"
        />
        <div className="flex-1 min-w-0">
          <h1 className="t-display text-[clamp(1.5rem,7vw,1.875rem)] leading-[0.95] text-white truncate">
            {displayName}
            <span className="text-naranja">.</span>
          </h1>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span className="t-mono text-[0.5625rem] tracking-[0.14em] bg-tinta text-lima rounded-pill px-2 py-1 whitespace-nowrap">
              {profile.skill_level || "Unrated"}
            </span>
            {profile.home_club && (
              <span className="t-mono text-[0.5625rem] tracking-[0.14em] border-2 border-papel/40 text-papel/80 rounded-pill px-2 py-0.75 whitespace-nowrap max-w-full truncate">
                {profile.home_club}
              </span>
            )}
          </div>
        </div>

        {/* Quick actions — owner only: edit the profile, or open settings. */}
        {isOwner && !editing && (
          <div className="flex flex-col gap-1.75 flex-none">
            <button
              type="button"
              onClick={startEdit}
              aria-label="Edit profile"
              className="size-8.5 rounded-pill border-2 border-papel/35 bg-white/8 hover:bg-white/18 grid place-items-center transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
                <path
                  d="M15.5 5.5l3 3L9 18H6v-3z"
                  stroke="var(--color-papel)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <Link
              href="/profile"
              aria-label="Settings"
              className="size-8.5 rounded-pill border-2 border-papel/35 bg-white/8 hover:bg-white/18 grid place-items-center transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="3.2" stroke="var(--color-papel)" strokeWidth="2" />
                <path
                  d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3L5.6 5.6"
                  stroke="var(--color-papel)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          </div>
        )}
      </header>

      {/* ── Stats poster ─────────────────────────────────────────────────── */}
      <div className="pl-card flex mt-3.5 overflow-hidden">
        {stats.map((s, i) => {
          const inner = (
            <>
              <div
                className={`t-display text-[1.1875rem] leading-none truncate ${
                  s.accent ? "text-naranja" : "text-tinta"
                }`}
              >
                {s.value}
              </div>
              <div className="t-mono text-[0.5625rem] tracking-[0.14em] text-tinta/55 mt-1 whitespace-nowrap">
                {s.label}
              </div>
            </>
          );
          const cell = `flex-1 min-w-0 text-center px-1 py-2.75 ${
            i ? "border-l-2 border-tinta/15" : ""
          }`;
          return s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className={`${cell} hover:bg-lima/25 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-naranja`}
            >
              {inner}
            </Link>
          ) : (
            <div key={s.label} className={cell}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Connect / Connected — only on someone else's profile. */}
      {!isOwner && (
        <Button
          variant={connected ? "secondary" : "primary"}
          className="mt-3"
          onClick={handleToggleConnect}
          loading={connBusy}
        >
          {connected ? "Connected ✓" : "Connect"}
        </Button>
      )}

      {/* ── Segmented control ────────────────────────────────────────────── */}
      {!editing && (
        <div
          role="tablist"
          aria-label="Profile sections"
          className="flex gap-1.5 mt-3 bg-[rgb(6_20_58/0.35)] border-2 border-papel/22 rounded-[3px] p-1"
        >
          {(["Overview", "Badges", "Code"] as Tab[])
            // The code panel is the owner's own sharing tool.
            .filter((t) => t !== "Code" || isOwner)
            .map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`t-mono flex-1 py-2 px-1 rounded-stamp text-micro transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lima ${
                  tab === t ? "bg-papel text-tinta" : "text-papel/65 hover:text-papel"
                }`}
              >
                {t}
              </button>
            ))}
        </div>
      )}

      {/* ── Edit form — owner only, replaces the panels while open ───────── */}
      {editing && (
        <div className="pl-card p-4 mt-3.5">
          <div className="flex items-center gap-4">
            <PlayerAvatar
              userId={playerId}
              avatarUrl={fAvatarUrl}
              name={fName || displayName}
              className="size-14 border-2 border-tinta"
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
              <p className="text-label font-medium text-tinta/45 mt-1.5">
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
            <span className="t-mono text-micro text-tinta/70">Display name</span>
            <Input
              type="text"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              placeholder="Your name"
              className="mt-1.5"
            />
          </label>

          <div className="mt-3">
            <span className="t-mono text-micro text-tinta/70">Skill level</span>
            <div className="mt-1.5">
              <SkillLevelPicker value={fSkill} onChange={setFSkill} />
            </div>
          </div>

          <label className="block mt-3">
            <span className="t-mono text-micro text-tinta/70">Home club</span>
            <Input
              type="text"
              value={fClub}
              onChange={(e) => setFClub(e.target.value)}
              placeholder="e.g. Malahide Padel Club"
              className="mt-1.5"
            />
          </label>

          <label className="block mt-3">
            <span className="t-mono text-micro text-tinta/70">Bio</span>
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
            className={`text-center text-label font-semibold text-naranja-d mt-2 ${error ? "" : "hidden"}`}
          >
            {error}
          </p>
        </div>
      )}

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {!editing && tab === "Overview" && (
        <>
          {/* Form — the last eight confirmed results as stamped cells, with
              the current run called out in riso orange. */}
          <div className="pl-card px-3.5 py-3.25 mt-3">
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="t-mono text-tiny tracking-[0.18em] text-tinta/55 whitespace-nowrap">
                Form · last {form.length || 8}
              </span>
              <span className="t-mono text-micro text-naranja whitespace-nowrap">
                {currentStreak > 0 ? `W${currentStreak} streak` : "No streak"}
              </span>
            </div>

            {form.length > 0 ? (
              <div className="flex gap-1.25 mt-2.5">
                {form.map((r, i) => (
                  <span
                    key={i}
                    className={`t-mono flex-1 text-center py-1.5 rounded-stamp text-micro border-2 border-tinta ${
                      r.won ? "bg-lima text-tinta" : "bg-transparent text-tinta/45"
                    }`}
                  >
                    {r.won ? "W" : "L"}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-label font-medium text-tinta/55 mt-2.5">
                No confirmed results yet — play a game and log the score.
              </p>
            )}

            {/* Where this player's earned rating sits inside its 100-point
                band, with the next hundred as the target. */}
            {profile.rating != null && (
              <div className="flex items-center gap-2.5 mt-3 pt-2.75 border-t-2 border-dashed border-tinta/22">
                <span className="t-mono text-micro text-tinta/60 whitespace-nowrap">
                  {profile.rating}
                </span>
                <Bar pct={profile.rating % 100} className="flex-1 h-2" />
                <span className="t-mono text-micro text-tinta/60 whitespace-nowrap">
                  {Math.floor(profile.rating / 100) * 100 + 100}
                </span>
              </div>
            )}
          </div>

          <Rule>Upcoming games</Rule>
          {games.length > 0 ? (
            <div className="flex flex-col gap-2.25">
              {games.map((game) => (
                <UpcomingGameRow key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <div className="pl-surface rounded-card px-4 py-5 text-center text-body font-medium text-tinta/70">
              {isOwner
                ? "Nothing coming up — your next game is waiting on Discover."
                : `${displayName} has no games coming up.`}
            </div>
          )}

          <Rule>About</Rule>
          <div className="pl-card p-3.5">
            <div className="flex items-center gap-2 text-body font-medium text-tinta/70">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                className="shrink-0 text-naranja-d"
              >
                <path
                  d="M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span>{profile.home_club || "No home club set"}</span>
            </div>
            {profile.bio && (
              <p className="text-body font-medium text-tinta whitespace-pre-line mt-3 pt-3 border-t-2 border-tinta/15">
                {profile.bio}
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Badges ───────────────────────────────────────────────────────── */}
      {!editing && tab === "Badges" && (
        <>
          <div className="grid grid-cols-3 gap-2.25 mt-3">
            {badges.flatMap((fam) =>
              // Every rung of every family: the ones cleared are printed
              // posters, the rest are dashed outlines waiting to be earned.
              [...fam.earned, ...(fam.next ? [fam.next] : [])].map((b) => {
                const earned = fam.value >= b.threshold;
                return (
                  <div
                    key={b.id}
                    title={b.blurb}
                    className={`flex flex-col items-center gap-1.75 px-1.5 py-3 rounded-card border-2 ${
                      earned
                        ? "border-solid border-tinta bg-papel shadow-[4px_4px_0_rgb(6_20_58/0.4)]"
                        : "border-dashed border-papel/35 bg-white/6"
                    }`}
                  >
                    <span
                      className={`size-9.5 rounded-pill grid place-items-center text-[1.125rem] border-2 ${
                        earned
                          ? "border-tinta bg-naranja text-white"
                          : "border-papel/35 text-papel/45"
                      }`}
                      aria-hidden
                    >
                      {b.family === "games" ? "⬢" : b.family === "streak" ? "⚡" : "★"}
                    </span>
                    <span
                      className={`t-mono text-[0.5625rem] tracking-[0.08em] text-center leading-tight ${
                        earned ? "text-tinta" : "text-papel/55"
                      }`}
                    >
                      {b.title}
                    </span>
                  </div>
                );
              }),
            )}
          </div>

          <Rule>Next up</Rule>
          <div className="flex flex-col gap-2.25">
            {badges
              .filter((fam) => fam.next)
              .map((fam) => (
                <div key={fam.family} className="pl-card px-3.5 py-2.75">
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="t-display text-[0.875rem] text-tinta truncate">
                      {fam.next!.title}
                    </span>
                    <span className="t-mono text-micro text-tinta/60 whitespace-nowrap">
                      {fam.value} / {fam.next!.threshold}
                    </span>
                  </div>
                  <Bar
                    pct={(fam.value / fam.next!.threshold) * 100}
                    className="h-2.25 mt-2.25"
                  />
                </div>
              ))}
            {badges.every((fam) => !fam.next) && (
              <div className="pl-surface rounded-card px-4 py-5 text-center text-body font-medium text-tinta/70">
                Every badge earned. Nothing left to chase.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Code — owner only ────────────────────────────────────────────── */}
      {!editing && tab === "Code" && isOwner && (
        <>
          <div className="pl-card shadow-poster p-4.5 text-center mt-3">
            {qrPanel === "code" ? (
              <>
                {origin && <PlayerQRCode url={`${origin}/players/${playerId}`} />}
                <div className="t-mono text-tiny tracking-[0.18em] text-tinta/55 mt-3.5">
                  Scan to add {displayName}
                </div>
              </>
            ) : (
              <>
                <QRScanner key={scanKey} onScan={handleScan} />
                {scanError && (
                  <div className="mt-3">
                    <p className="text-label font-semibold text-naranja-d">
                      {scanError}
                    </p>
                    <button
                      type="button"
                      onClick={retryScan}
                      className="t-mono text-micro text-tinta/70 underline mt-1.5"
                    >
                      Scan again
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <button
              type="button"
              onClick={() => {
                setQrPanel(qrPanel === "code" ? "scan" : "code");
                setScanError(null);
              }}
              className="t-mono pena-riso flex items-center justify-center gap-2 bg-lima text-tinta border-2 border-tinta rounded-card py-3.25 px-2.5 text-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papel"
            >
              {qrPanel === "code" ? "Scan" : "My code"}
            </button>
            <Link
              href="/search"
              className="t-mono flex items-center justify-center gap-2 bg-transparent text-papel border-2 border-papel/45 hover:border-lima hover:text-lima rounded-card py-3.25 px-2.5 text-micro transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
            >
              Find by name
            </Link>
          </div>
        </>
      )}

      {/* Log out — the one destructive action, kept quiet and dashed. */}
      {isOwner && !editing && (
        <button
          type="button"
          onClick={handleLogout}
          className="t-mono w-full mt-4 bg-transparent hover:bg-naranja/12 border-2 border-dashed border-naranja/70 text-naranja rounded-card py-3 text-micro tracking-[0.16em] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
        >
          Log out
        </button>
      )}

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
