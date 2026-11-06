"use client";
// A player's profile, at /players/[id]. Anyone can view it. The player themselves
// also gets settings, editing, their QR code and My Games; everyone else can
// connect, block or report.
//
// Real data only. Each result's rating change isn't stored, so result rows don't
// show one. The Rating figure rolls from the number you last saw to the new one
// after a result, with the change beside it, once.
//
// Like the rest of the app this reads the player client-side using the shared
// Supabase client, so the same auth/env setup applies everywhere.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import EditProfileSheet from "@/components/EditProfileSheet";
import Alert from "@/components/ios/Alert";
import GameRow from "@/components/ios/GameRow";
import Icon, { type IconName } from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import PlayerQRCode from "@/components/PlayerQRCode";
import QRScanner from "@/components/QRScanner";
import ReportDialog from "@/components/ReportDialog";
import { getGame as getGameWithPlayers } from "@/lib/data";
import { previousPath } from "@/lib/navMemory";
import { supabase } from "@/lib/supabaseClient";
import type { Game as GameCardData } from "@/lib/types";
import { computeBadges, longestWinStreak, type BadgeProgress } from "../../badges";
import { blockUser, getBlockedIds, isBlocked, unblockUser } from "../../blocks";
import { areConnected, connect, disconnect, getConnectionCount } from "../../connections";
import { getUpcomingGamesFor } from "../../games";
import {
  getPlayerMatchStats,
  getPlayerResultHistory,
  getRecentResults,
  RELIABILITY_MIN_GAMES,
  type PlayerMatchStats,
  type PlayerResultOutcome,
  type RecentResult,
} from "../../match-results";
import { getProfile, type Profile } from "../../profiles";

const UPCOMING_ROWS = 2;
const RECENT_ROWS = 2;

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

/* The rating the player last saw, so a change only rolls once. */
function seenRatingKey(id: string) {
  return `rating-seen:${id}`;
}
function readSeenRating(id: string): number | null {
  try {
    const raw = localStorage.getItem(seenRatingKey(id));
    return raw == null ? null : Number(raw);
  } catch {
    return null;
  }
}
function writeSeenRating(id: string, rating: number) {
  try {
    localStorage.setItem(seenRatingKey(id), String(rating));
  } catch {
    // Private browsing can refuse this. The change just won't be shown.
  }
}

/* Digits roll from the old number to the new one: 300 ms, easing out. */
function RollingNumber({ from, to }: { from: number | null; to: number }) {
  const format = (n: number) => n.toLocaleString("en-IE");
  const next = format(to);
  if (from == null || from === to) return <>{next}</>;
  const old = format(from).padStart(next.length, " ");
  return (
    <span className="ios-roll" aria-label={next}>
      {[...next].map((char, i) =>
        old[i] === char ? (
          <span key={i} aria-hidden>{char}</span>
        ) : (
          <span key={i} className="ios-roll-digit" aria-hidden>
            <span>{old[i] === " " ? " " : old[i]}</span>
            <span>{char}</span>
          </span>
        ),
      )}
    </span>
  );
}

function Stat({ value, label, extra }: { value: React.ReactNode; label: string; extra?: React.ReactNode }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div className="ios-t2">{value}</div>
      <div className="ios-fn ios-sec">
        {label}
        {extra}
      </div>
    </div>
  );
}

function ListRow({
  icon,
  label,
  value,
  sub,
  href,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  sub?: string;
  href?: string;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <span className="ios-rico">
        <Icon name={icon} size={22} />
      </span>
      <span className="ios-grow" style={{ textAlign: "left" }}>
        <span className="ios-bd" style={{ display: "block" }}>{label}</span>
        {sub && <span className="ios-fn ios-sec" style={{ display: "block" }}>{sub}</span>}
      </span>
      {value && <span className="ios-bd ios-sec">{value}</span>}
      {(href || onPress) && (
        <span className="ios-chev">
          <Icon name="chevron-right" size={13} />
        </span>
      )}
    </>
  );
  const style = { minHeight: 48, padding: sub ? "9px 16px" : "0 16px", "--ios-inset": "52px" } as React.CSSProperties;
  if (href) {
    return (
      <Link href={href} className="ios-row ios-link" style={style}>
        {inner}
      </Link>
    );
  }
  if (onPress) {
    return (
      <button type="button" className="ios-row ios-toggle-row" style={style} onClick={onPress}>
        {inner}
      </button>
    );
  }
  return (
    <div className="ios-row" style={style}>
      {inner}
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="ios">
      {children}
      <BottomNav />
    </main>
  );
}

function ToolButton({ label, onPress, icon }: { label: string; onPress: () => void; icon: IconName }) {
  return (
    <button type="button" className="ios-gcap-i ios-glass ios-press" aria-label={label} onClick={onPress}>
      <Icon name={icon} size={20} />
    </button>
  );
}

/* A page pushed from the profile: Badges or My Code. */
function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <PageShell>
      <div className="ios-profile-tools">
        <ToolButton label="Back to profile" icon="chevron-left" onPress={onBack} />
      </div>
      <h1 className="ios-lt" style={{ padding: "calc(var(--ios-top-gap) + 52px) 20px 8px" }}>
        {title}
      </h1>
      {children}
    </PageShell>
  );
}

function BadgesPage({ badges, onBack }: { badges: BadgeProgress[]; onBack: () => void }) {
  return (
    <SubPage title="Badges" onBack={onBack}>
      {badges.map((family) => (
        <section key={family.family} style={{ marginTop: 10 }}>
          <div className="ios-sect">
            <h2 className="ios-t3">{family.label}</h2>
            <div className="ios-fn ios-sec">{family.value}</div>
          </div>
          <div className="ios-list">
            {family.earned.map((badge) => (
              <div key={badge.id} className="ios-row" style={{ padding: "9px 16px" }}>
                <div className="ios-grow">
                  <div className="ios-bd">{badge.title}</div>
                  <div className="ios-fn ios-sec">{badge.blurb}</div>
                </div>
                <span className="ios-acc" aria-label="Earned">
                  <Icon name="check" size={16} />
                </span>
              </div>
            ))}
            {family.next && (
              <div className="ios-row" style={{ padding: "9px 16px" }}>
                <div className="ios-grow">
                  <div className="ios-bd">{family.next.title}</div>
                  <div
                    className="ios-progress"
                    role="progressbar"
                    aria-valuenow={family.value}
                    aria-valuemax={family.next.threshold}
                    aria-label={`${family.value} of ${family.next.threshold}`}
                  >
                    <i style={{ width: `${Math.min(100, (family.value / family.next.threshold) * 100)}%` }} />
                  </div>
                </div>
                <div className="ios-fn ios-sec" style={{ whiteSpace: "nowrap" }}>
                  {family.value} of {family.next.threshold}
                </div>
              </div>
            )}
          </div>
        </section>
      ))}
    </SubPage>
  );
}

function CodePage({ playerId, name, onBack }: { playerId: string; name: string; onBack: () => void }) {
  const router = useRouter();
  const [panel, setPanel] = useState<"code" | "scan">("code");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0); // bumped to restart the camera after a bad scan

  function handleScan(text: string) {
    const id = extractPlayerId(text);
    if (id) router.push(`/players/${id}`);
    else setScanError("That doesn’t look like a Padel Loop player code.");
  }

  return (
    <SubPage title={panel === "code" ? "My Code" : "Scan a Code"} onBack={onBack}>
      <div className="ios-card" style={{ padding: 20, marginTop: 6, textAlign: "center" }}>
        {panel === "code" ? (
          <>
            <PlayerQRCode url={`${window.location.origin}/players/${playerId}`} />
            <div className="ios-fn ios-sec" style={{ marginTop: 10 }}>
              Scan to add {name}
            </div>
          </>
        ) : (
          <>
            <QRScanner key={scanKey} onScan={handleScan} />
            {scanError && (
              <div style={{ marginTop: 10 }} role="alert">
                <div className="ios-fn ios-destructive">{scanError}</div>
                <button
                  type="button"
                  className="ios-cl ios-acc ios-md"
                  style={{ border: 0, padding: 0, background: "none", cursor: "pointer", marginTop: 2 }}
                  onClick={() => {
                    setScanError(null);
                    setScanKey((k) => k + 1); // remounts the scanner, which restarts the camera
                  }}
                >
                  Scan Again
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, margin: "12px 16px 0" }}>
        <button
          type="button"
          className="ios-pill ios-press"
          style={{ border: 0, cursor: "pointer" }}
          onClick={() => {
            setPanel(panel === "code" ? "scan" : "code");
            setScanError(null);
          }}
        >
          {panel === "code" ? "Scan a Code" : "My Code"}
        </button>
        <Link href="/search" className="ios-pill ios-press">
          Find by Name
        </Link>
      </div>
    </SubPage>
  );
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const playerId = params.id;

  const [loading, setLoading] = useState(true);
  // Separate from "player not found". A failed load rendering as a missing
  // player tells somebody their friend deleted their account.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<GameCardData[]>([]);
  const [results, setResults] = useState<RecentResult[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [matchStats, setMatchStats] = useState<PlayerMatchStats>({
    reliability: { recorded: 0, attended: 0, percent: null },
    played: 0,
    won: 0,
    lost: 0,
  });
  const [history, setHistory] = useState<PlayerResultOutcome[]>([]);
  const [connCount, setConnCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [connBusy, setConnBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState<"profile" | "badges" | "code">("profile");
  const [ratingFrom, setRatingFrom] = useState<number | null>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const profileScroll = useRef(0);

  const isOwner = currentUserId === playerId;

  useEffect(() => {
    let active = true;
    (async () => {
      let auth, loaded, games, count, stats, hist;
      try {
        [{ data: auth }, loaded, games, count, stats, hist] = await Promise.all([
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
      const viewerId = auth.user?.id ?? null;
      const [cards, recent, blockedList, isConn, viewerBlocked] = await Promise.all([
        Promise.all(games.slice(0, UPCOMING_ROWS).map((g) => getGameWithPlayers(String(g.id)))),
        getRecentResults(playerId, RECENT_ROWS),
        getBlockedIds(viewerId),
        viewerId && viewerId !== playerId ? areConnected(viewerId, playerId) : Promise.resolve(false),
        viewerId && viewerId !== playerId ? isBlocked(viewerId, playerId) : Promise.resolve(false),
      ]);
      if (!active) return;

      setFailed(false);
      setProfile(loaded);
      setCurrentUserId(viewerId);
      setUpcoming(cards.filter((g): g is GameCardData => g != null));
      setResults(recent);
      setBlockedIds(blockedList);
      setConnCount(count);
      setMatchStats(stats);
      setHistory(hist);
      setConnected(isConn);
      setBlocked(viewerBlocked);
      if (viewerId === playerId && loaded?.rating != null) {
        const seen = readSeenRating(playerId);
        if (seen != null && seen !== loaded.rating) setRatingFrom(seen);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [playerId, attempt]);

  // Remember the rating once it has been shown, so the same change never rolls twice.
  useEffect(() => {
    if (!isOwner || profile?.rating == null) return;
    const rating = profile.rating;
    const timer = setTimeout(() => writeSeenRating(playerId, rating), 1000);
    return () => clearTimeout(timer);
  }, [isOwner, playerId, profile?.rating]);

  // Badges and My Code start at their top; coming back returns to the same place.
  useLayoutEffect(() => {
    window.scrollTo(0, page === "profile" ? profileScroll.current : 0);
  }, [page]);

  function openPage(next: "badges" | "code") {
    profileScroll.current = window.scrollY;
    setPage(next);
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  const badges: BadgeProgress[] = useMemo(
    () =>
      computeBadges({
        connections: connCount,
        gamesPlayed: matchStats.played,
        bestStreak: longestWinStreak(history),
      }),
    [connCount, matchStats.played, history],
  );
  const earnedBadges = badges.reduce((n, family) => n + family.earned.length, 0);

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
      } else {
        setMessage("Couldn’t disconnect. Try again.");
      }
    } else {
      const result = await connect(currentUserId, playerId);
      if ("ok" in result) {
        setConnected(true);
        setConnCount((c) => c + 1);
      } else {
        setMessage("Couldn’t connect. Try again.");
      }
    }
    setConnBusy(false);
  }

  async function handleBlock() {
    if (!currentUserId || blockBusy) return;
    setBlockBusy(true);
    const result = await blockUser(currentUserId, playerId);
    if ("ok" in result) {
      setBlocked(true);
      // Blocking drops any connection between the two in the database.
      setConnected(false);
    } else {
      setMessage(result.error);
    }
    setConfirmingBlock(false);
    setBlockBusy(false);
  }

  async function handleUnblock() {
    if (!currentUserId || blockBusy) return;
    setBlockBusy(true);
    const result = await unblockUser(currentUserId, playerId);
    if ("ok" in result) setBlocked(false);
    else setMessage(result.error);
    setBlockBusy(false);
  }

  function goBack() {
    if (previousPath()) router.back();
    else router.push("/discover"); // arrived from a shared link: nothing to go back to
  }

  if (loading) {
    return (
      <PageShell>
        <div aria-hidden style={{ paddingTop: "calc(var(--ios-top-gap) + 30px)" }}>
          <div className="ios-skel" style={{ width: 84, height: 84, borderRadius: "50%", margin: "0 auto" }} />
          <div className="ios-skel" style={{ height: 76, margin: "60px 16px 0" }} />
          <div className="ios-skel" style={{ height: 180, margin: "18px 16px 0" }} />
        </div>
      </PageShell>
    );
  }

  // Ordered BEFORE the not-found branch on purpose: a read that failed is not
  // evidence that the player is gone.
  if (failed) {
    return (
      <PageShell>
        <div className="ios-card" style={{ marginTop: "calc(var(--ios-top-gap) + 30px)", padding: 20 }} role="alert">
          <div className="ios-t3">Couldn’t Load This Profile</div>
          <div className="ios-sh ios-sec" style={{ marginTop: 4 }}>
            Check your connection and try again.
          </div>
          <div style={{ display: "flex", marginTop: 14 }}>
            <button
              type="button"
              className="ios-pill ios-press"
              style={{ border: 0, cursor: "pointer" }}
              onClick={() => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!profile) {
    return (
      <PageShell>
        <div className="ios-card" style={{ marginTop: "calc(var(--ios-top-gap) + 30px)", padding: 20 }}>
          <div className="ios-t3">Player Not Found</div>
          <div className="ios-sh ios-sec" style={{ marginTop: 4 }}>
            This player doesn’t have a profile yet.
          </div>
          <div style={{ display: "flex", marginTop: 14 }}>
            <Link href="/" className="ios-pill ios-press">
              Back to Home
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const name = profile.name || "Player";

  if (page === "badges") return <BadgesPage badges={badges} onBack={() => setPage("profile")} />;
  if (page === "code" && isOwner) return <CodePage playerId={playerId} name={name} onBack={() => setPage("profile")} />;

  const club = [profile.home_club, profile.home_area].filter(Boolean).join(", ");
  const subtitle = [profile.skill_level || "Unrated", club].filter(Boolean).join(" · ");
  const change = ratingFrom != null && profile.rating != null ? profile.rating - ratingFrom : 0;

  // Spelled out whenever there is no number, so a blank never reads as a bad
  // score: attendance is only recorded on results confirmed since it was added.
  const reliability = matchStats.reliability;
  const reliabilityNote =
    reliability.percent != null
      ? `Turned up to ${reliability.attended} of ${reliability.recorded} recorded games.`
      : reliability.recorded === 0
        ? "Starts counting when a match result is confirmed."
        : `Shows after ${RELIABILITY_MIN_GAMES} recorded games. ${reliability.recorded} so far.`;

  return (
    <PageShell>
      <div className="ios-profile-tools">
        {isOwner ? (
          <>
            <Link href="/profile" aria-label="Settings" className="ios-gcap-i ios-glass ios-press">
              <Icon name="gear" size={24} />
            </Link>
            <button type="button" className="ios-sheet-btn ios-glass ios-press" onClick={() => setEditing(true)}>
              Edit
            </button>
          </>
        ) : (
          <>
            <ToolButton label="Back" icon="chevron-left" onPress={goBack} />
            {currentUserId && (
              <button
                ref={moreButton}
                type="button"
                className="ios-gcap-i ios-glass ios-press"
                aria-label="More"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <Icon name="ellipsis" size={24} />
              </button>
            )}
          </>
        )}
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="ios-menu-scrim"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => {
              setMenuOpen(false);
              moreButton.current?.focus();
            }}
          />
          <div
            className="ios-menu ios-game-menu"
            role="menu"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setMenuOpen(false);
                moreButton.current?.focus();
              }
            }}
          >
            <button
              type="button"
              role="menuitem"
              autoFocus
              className="ios-menu-item"
              style={{ paddingLeft: 14 }}
              disabled={blockBusy}
              onClick={() => {
                setMenuOpen(false);
                if (blocked) handleUnblock();
                else setConfirmingBlock(true);
              }}
            >
              {blocked ? "Unblock" : "Block"}
            </button>
            <button
              type="button"
              role="menuitem"
              className="ios-menu-item"
              style={{ paddingLeft: 14 }}
              data-destructive
              onClick={() => {
                setMenuOpen(false);
                setReporting(true);
              }}
            >
              Report
            </button>
          </div>
        </>
      )}

      <header className="ios-profile-head">
        <Monogram name={name} photoUrl={profile.avatar_url} size={84} />
        <h1 className="ios-t1" style={{ marginTop: 8 }}>{name}</h1>
        <div className="ios-sh ios-sec">{subtitle}</div>
        {profile.bio && (
          <p className="ios-sh" style={{ margin: "6px 20px 0", whiteSpace: "pre-line" }}>
            {profile.bio}
          </p>
        )}
      </header>

      <div className="ios-card" style={{ marginTop: 14, padding: "12px 0", display: "flex" }}>
        <Stat
          value={profile.rating != null ? <RollingNumber from={ratingFrom} to={profile.rating} /> : "—"}
          label="Rating"
          extra={
            change !== 0 && (
              <span className={change > 0 ? "ios-rating-change ios-acc ios-sb" : "ios-rating-change ios-sb"}>
                {" "}
                {change > 0 ? `+${change}` : `−${Math.abs(change)}`}
              </span>
            )
          }
        />
        <div style={{ width: 0.5, background: "var(--ios-sep)", margin: "6px 0" }} />
        <Stat value={matchStats.played.toLocaleString("en-IE")} label="Played" />
        <div style={{ width: 0.5, background: "var(--ios-sep)", margin: "6px 0" }} />
        <Stat value={matchStats.won.toLocaleString("en-IE")} label="Won" />
      </div>

      {!isOwner && (
        <div style={{ display: "flex", margin: "12px 16px 0" }}>
          <button
            type="button"
            className="ios-wide-btn"
            data-tone={connected ? "tint" : "fill"}
            disabled={connBusy || blocked}
            aria-busy={connBusy || undefined}
            onClick={handleToggleConnect}
          >
            {blocked ? "Blocked" : connected ? "Connected" : "Connect"}
            {connected && <Icon name="check" size={15} />}
          </button>
        </div>
      )}

      <section style={{ marginTop: 18 }}>
        <div className="ios-sect">
          <h2 className="ios-t3">Upcoming</h2>
          {isOwner && (
            <Link href="/my-games" className="ios-cl ios-acc ios-md ios-link">
              See All
            </Link>
          )}
        </div>
        {upcoming.length > 0 ? (
          <div className="ios-list">
            {upcoming.map((game) => (
              <GameRow key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <div className="ios-card ios-sh ios-sec" style={{ padding: 16 }}>
            {isOwner ? "Nothing coming up. Your next game is waiting on Discover." : `${name} has no games coming up.`}
          </div>
        )}
      </section>

      <section style={{ marginTop: 18 }}>
        <div className="ios-sect">
          <h2 className="ios-t3">Recent Results</h2>
        </div>
        {results.length > 0 ? (
          <div className="ios-list">
            {results.map((result) => {
              const partner = result.partner && !blockedIds.has(result.partner.id) ? result.partner.name : null;
              return (
                <div key={result.id} className="ios-row" style={{ padding: "9px 16px" }}>
                  <div className="ios-grow">
                    <div className="ios-bd">
                      <span className="ios-sb">{result.won ? "Won" : "Lost"}</span> {result.score}
                    </div>
                    <div className="ios-fn ios-sec">
                      {[result.when, result.venue, partner && `with ${partner}`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {result.ratingChange != null && result.ratingChange !== 0 && (
                    <div className={result.won ? "ios-sh ios-md" : "ios-sh ios-md ios-sec"}>
                      {result.ratingChange > 0 ? `+${result.ratingChange}` : `−${Math.abs(result.ratingChange)}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ios-card ios-sh ios-sec" style={{ padding: 16 }}>
            No confirmed results yet.
          </div>
        )}
      </section>

      <div className="ios-list" style={{ marginTop: 12 }}>
        <ListRow icon="people" label="Connections" value={String(connCount)} href={isOwner ? "/connections" : undefined} />
        <ListRow icon="trophy" label="Leaderboard" href="/leaderboard" />
      </div>

      <div className="ios-list" style={{ marginTop: 12 }}>
        <ListRow icon="medal" label="Badges" value={String(earnedBadges)} onPress={() => openPage("badges")} />
        {isOwner && <ListRow icon="qr" label="My Code" onPress={() => openPage("code")} />}
        <ListRow
          icon="check-circle"
          label="Turns Up"
          value={reliability.percent != null ? `${reliability.percent}%` : undefined}
          sub={reliabilityNote}
        />
      </div>

      <div style={{ height: 16 }} />

      {message && (
        <div className="ios-toast ios-glass ios-fn" style={{ bottom: 91 }} role="status">
          {message}
        </div>
      )}

      {editing && (
        <EditProfileSheet
          profile={profile}
          onClose={() => setEditing(false)}
          onChanged={(patch) => setProfile((p) => (p ? { ...p, ...patch } : p))}
        />
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

      <Alert
        open={confirmingBlock}
        onClose={() => {
          if (!blockBusy) setConfirmingBlock(false);
        }}
        title={`Block ${name}?`}
        actions={[
          { label: "Cancel", bold: true, disabled: blockBusy, onPress: () => setConfirmingBlock(false) },
          { label: "Block", destructive: true, busy: blockBusy, onPress: handleBlock },
        ]}
      >
        They won’t be told. They’ll disappear from your search, connections and chats, and any connection between you is
        removed. It can’t take either of you out of a game you’ve both joined: they stay on the player list, marked as
        blocked, and you can leave if you’d rather not play.
      </Alert>
    </PageShell>
  );
}
