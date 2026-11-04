"use client";
// A player's public profile, at /players/[id]. Anyone can view it: avatar,
// name, skill level, home club, form, badges and the games they have coming up.
//
// If the person viewing IS the player (their logged-in id matches the id in
// the address), they also get an Edit mode to change their name, skill level,
// home club and bio, and to upload an avatar photo.
//
// Layout: who they are (avatar, name, level, quick actions), one row of stats,
// and a three-way segmented control — Overview · Badges · Code — over a
// scrolling body.
//
// Like the rest of the app this reads the player client-side using the shared
// Supabase client, so the same auth/env setup applies everywhere.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Flame, Star, Trophy } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import ScrollHeader from "@/components/court/ScrollHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import { publishAvatarChange } from "@/lib/avatarBus";
import { blockUser, isBlocked, unblockUser } from "../../blocks";
import ReportDialog from "@/components/ReportDialog";
import PlayerQRCode from "@/components/PlayerQRCode";
import QRScanner from "@/components/QRScanner";
import SkillLevelPicker from "@/components/SkillLevelPicker";
import { Button, Dialog, ErrorState, Input, Skeleton, Textarea } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import {
  getProfile,
  removeAvatar,
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
  RELIABILITY_MIN_GAMES,
  getPlayerResultHistory,
  type PlayerMatchStats,
  type PlayerResultOutcome,
} from "../../match-results";
import { computeBadges, longestWinStreak, type BadgeProgress } from "../../badges";

/* ── Small parts ───────────────────────────────────────────────────────────*/

// A section heading.
function Rule({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="c-title text-[1.125rem] mx-0.5 mb-2.5 mt-6">{children}</h2>
  );
}

// A progress bar.
function Bar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <span
      className={`block rounded-full overflow-hidden bg-c-fill ${className}`}
    >
      <span
        className="block h-full rounded-full bg-c-accent"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  );
}

// One upcoming game: the venue, then the when and where.
function UpcomingGameRow({ game }: { game: Game }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="pl-card c-press relative flex items-center gap-3 py-3 px-4 overflow-hidden"
    >
      <span className="flex-none size-9 rounded-full grid place-items-center bg-c-tint text-c-on-tint">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden>
          <path
            d="M4.5 6.5h15v13h-15zM8 4v4M16 4v4M4.5 11h15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[1rem] font-medium truncate">
          {game.venue}
        </span>
        <span className="block text-[0.875rem] text-c-sub mt-0.5 truncate">
          {formatGameTime(game.game_time)}
          {game.location ? ` · ${game.location}` : ""}
        </span>
      </span>
      <span className="flex-none text-[0.8125rem] text-c-sub">
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
    reliability: { recorded: 0, attended: 0, percent: null },
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
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // Blocking this player. One-directional: nothing here tells them.
  const [blocked, setBlocked] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  // Separate from "player not found". A failed load rendering as a missing
  // player tells somebody their friend deleted their account.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState(false);
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
      let auth, loadedProfile, upcoming, count, mStats, hist;
      try {
        [{ data: auth }, loadedProfile, upcoming, count, mStats, hist] =
          await Promise.all([
            supabase.auth.getUser(),
            getProfile(playerId),
            getUpcomingGamesFor(playerId),
            getConnectionCount(playerId),
            getPlayerMatchStats(playerId),
            getPlayerResultHistory(playerId),
          ]);
      } catch {
        if (!active) return;
        setFailed(true);
        setLoading(false);
        return;
      }
      if (!active) return;
      setFailed(false);

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
  }, [playerId, attempt]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Connect when not yet connected, disconnect when already connected. The
  // viewed player's connection count moves with it. Sends logged-out visitors
  // to log in first.
  // Load whether this viewer has blocked this player.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!currentUserId || currentUserId === playerId) return;
      const result = await isBlocked(currentUserId, playerId);
      if (active) setBlocked(result);
    })();
    return () => {
      active = false;
    };
  }, [currentUserId, playerId]);

  async function handleBlock() {
    if (!currentUserId || blockBusy) return;
    setBlockBusy(true);
    setBlockError(null);

    const result = await blockUser(currentUserId, playerId);

    if ("ok" in result) {
      setBlocked(true);
      // Blocking drops any connection between the two in the database, so
      // reflect that here rather than leaving a stale Connected button.
      setConnected(false);
      setConfirmingBlock(false);
    } else {
      setBlockError(result.error);
    }
    setBlockBusy(false);
  }

  async function handleUnblock() {
    if (!currentUserId || blockBusy) return;
    setBlockBusy(true);
    setBlockError(null);

    const result = await unblockUser(currentUserId, playerId);

    if ("ok" in result) {
      setBlocked(false);
    } else {
      setBlockError(result.error);
    }
    setBlockBusy(false);
  }

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

  // Delete the uploaded photo for good and drop back to the generated
  // DiceBear picture. Unlike the text fields this commits straight away
  // rather than waiting for Save, so we update the shown profile as well as
  // the form state — otherwise backing out of the edit form would show the
  // old photo again even though it is gone from the database.
  async function handleRemovePhoto() {
    if (removing) return;
    setRemoving(true);
    setError(null);

    const result = await removeAvatar(playerId);

    if ("ok" in result) {
      setFAvatarUrl(null);
      setProfile((prev) => (prev ? { ...prev, avatar_url: null } : prev));
      // Nudge the screens that cached the old photo (nav, home greeting).
      publishAvatarChange({ userId: playerId, avatarUrl: null });
      setConfirmingRemove(false);
    } else {
      // Nothing changed — their photo is still there and still works.
      setError("Couldn’t remove that photo. Please try again.");
    }
    setRemoving(false);
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
      // A newly uploaded photo only reaches the database here, so tell the
      // other screens about it too — same reason as in handleRemovePhoto.
      publishAvatarChange({ userId: playerId, avatarUrl: fAvatarUrl });
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
      <main className="court court-page px-4 pt-5 relative">
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

  // Ordered BEFORE the not-found branch on purpose: a read that failed is
  // not evidence that the player is gone.
  if (failed) {
    return (
      <main className="court court-page px-4 pt-6 relative">
        <div className="mt-10">
          <ErrorState
            title="Couldn't load this profile."
            body="The player is fine — this is us failing to fetch them."
            onRetry={() => {
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          />
        </div>
        <BottomNav />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="court court-page px-4 pt-6 relative">
        <h1 className="c-title text-[2rem] leading-tight mt-2">
          Player not found
        </h1>
        <p className="text-[1rem] text-c-sub mt-1.5">
          This player doesn&rsquo;t have a profile yet.
        </p>
        <Link
          href="/"
          className="inline-block font-medium text-c-accent text-[1rem] mt-4 rounded-field"
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
    // Turned up vs committed. Below the threshold there is no percentage —
    // an em dash, with the shortfall spelled out under the poster, rather
    // than a 0% that would read as a terrible record instead of no record.
    {
      label: "Reliable",
      value:
        matchStats.reliability.percent != null
          ? `${matchStats.reliability.percent}%`
          : "—",
    },
    {
      label: "Mates",
      value: String(connCount),
      href: isOwner ? "/connections" : undefined,
    },
  ];

  // What to say under the poster about the reliability cell. Spelled out
  // whenever there is no number, so an em dash never reads as a score of
  // nothing — and everyone will be in this state for a while, because
  // attendance is only recorded on results confirmed from now on.
  const reliabilityNote =
    matchStats.reliability.percent != null
      ? `Turned up to ${matchStats.reliability.attended} of ${matchStats.reliability.recorded} recorded games.`
      : matchStats.reliability.recorded === 0
        ? "No attendance recorded yet — it starts being tracked when a match result is confirmed."
        : `Reliability needs ${RELIABILITY_MIN_GAMES} recorded games. ${matchStats.reliability.recorded} so far.`;

  return (
    <main className="court court-page px-4 pt-5 relative">
      <ScrollHeader title={displayName} />

      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3.5">
        <PlayerAvatar
          userId={playerId}
          avatarUrl={shownAvatar}
          name={displayName}
          className="size-18 flex-none"
        />
        <div className="flex-1 min-w-0">
          <h1 className="c-title text-[1.75rem] leading-tight truncate">{displayName}</h1>
          <div className="text-[0.9375rem] leading-snug text-c-sub mt-0.5">
            {profile.skill_level || "Unrated"}
            {profile.home_club && ` · ${profile.home_club}`}
          </div>
        </div>

        {/* Quick actions — owner only: edit the profile, or open settings. */}
        {isOwner && !editing && (
          <div className="flex gap-2 flex-none">
            <button
              type="button"
              onClick={startEdit}
              aria-label="Edit profile"
              className="c-press size-10 rounded-full bg-c-card text-c-ink shadow-[var(--c-shadow)] grid place-items-center"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
                <path
                  d="M15.5 5.5l3 3L9 18H6v-3z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <Link
              href="/profile"
              aria-label="Settings"
              className="c-press size-10 rounded-full bg-c-card text-c-ink shadow-[var(--c-shadow)] grid place-items-center"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3L5.6 5.6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          </div>
        )}
      </header>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="pl-card flex mt-4 overflow-hidden">
        {stats.map((s, i) => {
          const inner = (
            <>
              <div
                className="c-title text-[1.25rem] leading-none truncate"
              >
                {s.value}
              </div>
              <div className="text-[0.75rem] text-c-sub mt-1 whitespace-nowrap">
                {s.label}
              </div>
            </>
          );
          const cell = `flex-1 min-w-0 text-center px-1 py-3.5 ${
            i ? "border-l border-c-line" : ""
          }`;
          return s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className={`${cell} hover:bg-c-fill`}
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

      {/* Says in words what the Reliable cell means — always shown, because an
          em dash on its own would read as a bad score rather than no score. */}
      <p className="text-[0.8125rem] text-c-sub mt-2 px-1">
        {reliabilityNote}
      </p>

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

      {/* Block / Unblock — quiet, under Connect, and only on somebody
          else's profile. Nothing here is visible to them. */}
      {!isOwner && currentUserId && (
        <>
          <button
            type="button"
            onClick={() =>
              blocked ? handleUnblock() : setConfirmingBlock(true)
            }
            disabled={blockBusy}
            className="block w-full text-center text-[0.875rem] text-c-sub h-11 mt-1 rounded-field disabled:opacity-50"
          >
            {blocked ? "Unblock this player" : "Block this player"}
          </button>
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="block w-full text-center text-[0.875rem] text-c-sub h-11 rounded-field"
          >
            Report this player
          </button>
          <p
            aria-live="polite"
            className={`text-center text-label font-semibold text-naranja-d mt-1.5 ${
              blockError ? "" : "hidden"
            }`}
          >
            {blockError}
          </p>
        </>
      )}

      {currentUserId && (
        <ReportDialog
          open={reporting}
          onClose={() => setReporting(false)}
          reporterId={currentUserId}
          reportedId={playerId}
          reportedName={profile.name}
          context="profile"
          alreadyBlocked={blocked}
          onBlocked={() => {
            setBlocked(true);
            setConnected(false); // blocking drops the connection
          }}
        />
      )}

      <Dialog
        open={confirmingBlock}
        onClose={() => !blockBusy && setConfirmingBlock(false)}
        title="Block this player?"
      >
        <p className="text-label font-medium text-tinta/70 mt-2">
          They won&rsquo;t be told, and nothing changes for them.
        </p>

        <p className="t-mono text-micro tracking-[0.12em] text-tinta/70 mt-3">
          For you, they disappear from
        </p>
        <ul className="text-label font-medium text-tinta/70 mt-1 space-y-0.5 list-disc pl-4">
          <li>Player search and your connections</li>
          <li>Chat threads, including messages already sent</li>
        </ul>

        <p className="t-mono text-micro tracking-[0.12em] text-tinta/70 mt-3">
          What blocking can&rsquo;t do
        </p>
        <p className="text-label font-medium text-tinta/70 mt-1">
          It won&rsquo;t take either of you out of a game you&rsquo;ve both
          joined — padel is four people on one court, so you&rsquo;d still be
          playing together. In a shared game they stay on the roster, marked
          as blocked, and you can leave the game if you&rsquo;d rather not.
        </p>

        <p className="text-label font-medium text-tinta/70 mt-3">
          Any connection between you is removed.
        </p>

        <div className="flex gap-2.5 mt-5">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setConfirmingBlock(false)}
            disabled={blockBusy}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleBlock}
            loading={blockBusy}
          >
            Block
          </Button>
        </div>
      </Dialog>

      {/* ── Segmented control ────────────────────────────────────────────── */}
      {!editing && (
        <div
          role="tablist"
          aria-label="Profile sections"
          className="flex gap-1 mt-4 bg-c-fill rounded-[14px] p-1"
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
                className={`flex-1 h-9 px-1 rounded-[11px] text-[0.9375rem] font-medium ${
                  tab === t ? "bg-c-card text-c-ink shadow-[var(--c-shadow)]" : "text-c-sub"
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
              <p className="text-label font-medium text-tinta/45 mt-1.5">
                JPG or PNG. Replaces your current photo.
              </p>
              {/* Only offered when there is an uploaded photo to remove — on
                  the generated picture there is nothing to delete. */}
              {fAvatarUrl && (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  disabled={uploading}
                  className="text-[0.875rem] text-c-danger mt-2 rounded-field disabled:opacity-50"
                >
                  Remove photo
                </button>
              )}
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
          {/* Form — the last eight confirmed results, with the current run
              called out. */}
          <div className="pl-card px-4 py-3.5 mt-3">
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="text-[1rem] font-medium whitespace-nowrap">
                Form · last {form.length || 8}
              </span>
              <span className="text-[0.875rem] text-c-sub whitespace-nowrap">
                {currentStreak > 0 ? `W${currentStreak} streak` : "No streak"}
              </span>
            </div>

            {form.length > 0 ? (
              <div className="flex gap-1.25 mt-2.5">
                {form.map((r, i) => (
                  <span
                    key={i}
                    className={`flex-1 text-center py-1.5 rounded-stamp text-[0.8125rem] font-medium ${
                      r.won ? "bg-c-accent text-c-on-accent" : "bg-c-fill text-c-sub"
                    }`}
                  >
                    {r.won ? "W" : "L"}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[0.875rem] text-c-sub mt-2.5">
                No confirmed results yet — play a game and log the score.
              </p>
            )}

            {/* Where this player's earned rating sits inside its 100-point
                band, with the next hundred as the target. */}
            {profile.rating != null && (
              <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-c-line">
                <span className="text-[0.8125rem] tabular-nums text-c-sub whitespace-nowrap">
                  {profile.rating}
                </span>
                <Bar pct={profile.rating % 100} className="flex-1 h-2" />
                <span className="text-[0.8125rem] tabular-nums text-c-sub whitespace-nowrap">
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
            <div className="pl-card px-4 py-5 text-center text-[0.9375rem] text-c-sub">
              {isOwner
                ? "Nothing coming up — your next game is waiting on Discover."
                : `${displayName} has no games coming up.`}
            </div>
          )}

          <Rule>About</Rule>
          <div className="pl-card p-4">
            <div className="flex items-center gap-2 text-[0.9375rem] text-c-sub">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                className="shrink-0"
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
              <p className="text-[1rem] whitespace-pre-line mt-3 pt-3 border-t border-c-line">
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
              // Every rung of every family: the ones cleared are solid, the
              // rest are faint, waiting to be earned.
              [...fam.earned, ...(fam.next ? [fam.next] : [])].map((b) => {
                const earned = fam.value >= b.threshold;
                return (
                  <div
                    key={b.id}
                    title={b.blurb}
                    className={`flex flex-col items-center gap-1.75 px-1.5 py-3 rounded-card ${
                      earned ? "bg-c-card shadow-[var(--c-shadow)]" : "bg-c-fill"
                    }`}
                  >
                    <span
                      className={`size-9.5 rounded-full grid place-items-center ${
                        earned ? "bg-c-accent text-c-on-accent" : "text-c-sub"
                      }`}
                      aria-hidden
                    >
                      {b.family === "games" ? (
                        <Trophy size={18} />
                      ) : b.family === "streak" ? (
                        <Flame size={18} />
                      ) : (
                        <Star size={18} />
                      )}
                    </span>
                    <span
                      className={`text-[0.75rem] text-center leading-tight ${
                        earned ? "text-c-ink" : "text-c-sub"
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
                <div key={fam.family} className="pl-card px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="text-[1rem] font-medium truncate">
                      {fam.next!.title}
                    </span>
                    <span className="text-[0.8125rem] tabular-nums text-c-sub whitespace-nowrap">
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
              <div className="pl-card px-4 py-5 text-center text-[0.9375rem] text-c-sub">
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
                <div className="text-[0.875rem] text-c-sub mt-3.5">
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
                      className="text-[0.875rem] text-c-accent mt-1.5"
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
              className="c-press flex items-center justify-center h-12 rounded-[14px] bg-c-accent text-c-on-accent text-[1rem] font-semibold"
            >
              {qrPanel === "code" ? "Scan" : "My code"}
            </button>
            <Link
              href="/search"
              className="c-press flex items-center justify-center h-12 rounded-[14px] bg-c-card text-c-ink shadow-[var(--c-shadow)] text-[1rem] font-medium"
            >
              Find by name
            </Link>
          </div>
        </>
      )}

      {/* Log out — the one destructive action, kept quiet. */}
      {isOwner && !editing && (
        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-12 mt-6 text-c-danger rounded-[14px] text-[1rem] font-medium hover:bg-c-fill"
        >
          Log out
        </button>
      )}

      <div className="h-4" />
      {/* Removing a photo is destructive and immediate, so it asks first —
          a centred confirm card, same as cancelling a game. */}
      <Dialog
        open={confirmingRemove}
        onClose={() => !removing && setConfirmingRemove(false)}
        title="Remove your photo?"
      >
        <p className="text-label font-medium text-tinta/70 mt-2">
          Your photo will be deleted and you&rsquo;ll go back to your generated
          Padel Loop picture. You can upload a new one any time.
        </p>

        <div className="flex gap-2.5 mt-5">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setConfirmingRemove(false)}
            disabled={removing}
          >
            Keep photo
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleRemovePhoto}
            loading={removing}
          >
            Remove
          </Button>
        </div>
      </Dialog>

      <BottomNav />
    </main>
  );
}
