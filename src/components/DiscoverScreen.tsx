"use client";

// Discover: every game you could join, by day, with filters for your level, the
// date, the area and the time of day.
//
// Real data only. The mockup also shows distance and a "Within 10 km" filter,
// which need club locations the app doesn't store yet, so the Area filter takes
// that place for now.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Court, { spotsFor } from "@/components/ios/Court";
import Icon from "@/components/ios/Icon";
import JoinPill from "@/components/ios/JoinPill";
import Monogram from "@/components/ios/Monogram";
import { supabase } from "@/lib/supabaseClient";
import { initialsFrom, loadGames } from "@/lib/data";
import { dublinDateKey } from "@/lib/time";
import { formatPrice, isFull, skillTierOf, tierOfPlayer, type Game } from "@/lib/types";
import { usePlayerSearch } from "@/lib/usePlayerSearch";
import { clockTime, dayHeading, dublinHour, spotsOpenText } from "@/lib/when";
import { getConnections } from "@/app/connections";
import { getJoinedOrCreatedGameIds } from "@/app/games";
import { getProfile, type ProfileSearchResult } from "@/app/profiles";

const DAY_MS = 86_400_000;
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const DATES = ["Today", "Tomorrow", "Next 7 Days", "All Dates"];
const DEFAULT_DATES = "Next 7 Days";
const TIMES = ["Morning", "Afternoon", "Evening"];

type View = {
  query: string;
  level: string | null;
  dates: string;
  area: string | null;
  time: string | null;
  connectionsOnly: boolean;
};

const CLEAR: View = { query: "", level: null, dates: "All Dates", area: null, time: null, connectionsOnly: false };
const STORE_KEY = "discover-view";

// The filters and scroll position are kept for this visit, so backing out of a
// game returns you to the same place in the list, as a native tab would.
function readStored(): (View & { y: number }) | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeStored(value: View & { y: number }) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    // Private browsing can refuse this. The screen works without it.
  }
}

function matchesDates(game: Game, dates: string, now: number): boolean {
  const start = new Date(game.startsAt);
  if (dates === "All Dates" || Number.isNaN(start.getTime())) return true;
  if (dates === "Today") return dublinDateKey(start) === dublinDateKey(new Date(now));
  if (dates === "Tomorrow") return dublinDateKey(start) === dublinDateKey(new Date(now + DAY_MS));
  return start.getTime() <= now + 7 * DAY_MS;
}

function matchesTime(game: Game, time: string | null): boolean {
  if (!time) return true;
  const hour = dublinHour(game.startsAt);
  if (time === "Morning") return hour < 12;
  if (time === "Afternoon") return hour >= 12 && hour < 17;
  return hour >= 17;
}

/* Voice search, where the phone's browser offers it. Where it doesn't, the
   microphone isn't shown at all. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function speechRecogniser(): any {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const noSubscribe = () => () => {};

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canDictate = useSyncExternalStore(noSubscribe, () => speechRecogniser() != null, () => false);
  const [listening, setListening] = useState(false);

  function dictate() {
    const Recogniser = speechRecogniser();
    if (!Recogniser || listening) return;
    const recogniser = new Recogniser();
    recogniser.lang = "en-IE";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recogniser.onresult = (e: any) => onChange(e.results?.[0]?.[0]?.transcript ?? "");
    recogniser.onend = () => setListening(false);
    recogniser.onerror = () => setListening(false);
    setListening(true);
    recogniser.start();
  }

  return (
    <div className="ios-search" role="search">
      <Icon name="search" size={20} />
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Clubs, areas or players"
        aria-label="Search clubs, areas or players"
      />
      {value ? (
        <button type="button" className="ios-search-btn" aria-label="Clear search" onClick={() => onChange("")}>
          <Icon name="clear" size={18} />
        </button>
      ) : canDictate ? (
        <button type="button" className="ios-search-btn" aria-label="Search by voice" aria-pressed={listening} onClick={dictate}>
          <Icon name="mic" size={19} />
        </button>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  value,
  allLabel,
  options,
  active,
  onChange,
}: {
  label: string; // what the chip says with nothing chosen
  value: string | null;
  allLabel?: string; // the "no filter" choice, if there is one
  options: string[];
  active: boolean;
  onChange: (v: string | null) => void;
}) {
  const [menuAt, setMenuAt] = useState<{ top: number; left: number } | null>(null);
  const chip = useRef<HTMLButtonElement>(null);

  function close() {
    setMenuAt(null);
    chip.current?.focus();
  }
  function choose(v: string | null) {
    onChange(v);
    close();
  }

  return (
    <>
      <button
        ref={chip}
        type="button"
        className="ios-chip ios-press"
        data-on={active}
        aria-haspopup="menu"
        aria-expanded={menuAt != null}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenuAt({ top: r.bottom + 8, left: Math.max(16, Math.min(r.left, window.innerWidth - 236)) });
        }}
      >
        {value ?? label}
        <Icon name="chevron-down" size={11} />
      </button>
      {menuAt && (
        <>
          <button type="button" className="ios-menu-scrim" aria-label="Close menu" tabIndex={-1} onClick={close} />
          <div
            className="ios-menu"
            role="menu"
            aria-label={label}
            style={{ top: menuAt.top, left: menuAt.left, maxHeight: `calc(100dvh - ${menuAt.top + 110}px)` }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
          >
            {[...(allLabel ? [allLabel] : []), ...options].map((option, i) => {
              const optionValue = allLabel && i === 0 ? null : option;
              const checked = value === optionValue;
              return (
                <button
                  key={option}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  autoFocus={checked}
                  className="ios-menu-item"
                  onClick={() => choose(optionValue)}
                >
                  <span className="ios-menu-tick">{checked && <Icon name="check" size={14} />}</span>
                  {option}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function GameCard({
  game,
  userId,
  viewerInitials,
  now,
}: {
  game: Game;
  userId: string | null;
  viewerInitials: string;
  now: Date;
}) {
  const [joined, setJoined] = useState(false);
  const [failed, setFailed] = useState(false);
  const players = useMemo(
    () => (joined && userId ? [...game.players, { id: userId, initials: viewerInitials }] : game.players),
    [joined, game.players, userId, viewerInitials],
  );
  const open = game.maxPlayers - players.length - game.guestCount;
  const time = clockTime(game.startsAt);
  const price = formatPrice(game.pricePerPlayer);
  // Full and closed games stay listed, because their page offers the waitlist.
  const joinable = joined || (!isFull(game) && !game.isManuallyClosed);
  const status = failed ? "Couldn’t join. Try again." : game.isManuallyClosed ? "Closed" : open > 0 ? spotsOpenText(open) : "Full";
  const statusIsOpen = !failed && !game.isManuallyClosed && open > 0;

  return (
    <article className="ios-card" style={{ margin: "0 16px 10px", padding: "14px 14px 12px 16px" }}>
      <Link
        href={`/games/${game.id}`}
        className="ios-link ios-press"
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <div className="ios-grow">
          <div className="ios-t3">
            {time}
            {game.durationMins != null && (
              <span className="ios-sh ios-sec" style={{ fontWeight: 400, marginLeft: 6 }}>
                {game.durationMins} min
              </span>
            )}
          </div>
          <div className="ios-hl" style={{ marginTop: 2 }}>
            {game.venue}
          </div>
          {game.area && <div className="ios-sh ios-sec">{game.area}</div>}
        </div>
        <div style={{ width: 112, flex: "none" }}>
          <Court
            spots={spotsFor(players, game.maxPlayers, null, game.guestCount)}
            label={`Court with ${players.length + game.guestCount} of ${game.maxPlayers} spots taken, ${status}`}
          />
        </div>
      </Link>
      <div style={{ height: 0.5, background: "var(--ios-sep)", margin: "11px 0 10px" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 34 }}>
        <div className="ios-sh ios-grow" aria-live="polite">
          <span className={statusIsOpen ? "ios-sb ios-acc" : "ios-sb ios-sec"}>{status}</span>
          <span className="ios-sec">
            {" · "}
            {skillTierOf(game)}
            {price && ` · ${price}`}
          </span>
        </div>
        {joinable && (
          <JoinPill
            gameId={game.id}
            gameLabel={`${dayHeading(game.startsAt, now)}, ${time} at ${game.venue}`}
            userId={userId}
            priced={game.pricePerPlayer != null}
            onFailed={() => setFailed(true)}
            onJoined={() => {
              setFailed(false);
              setJoined(true);
            }}
          />
        )}
      </div>
    </article>
  );
}

function PlayerResults({
  results,
  failed,
  retry,
}: {
  results: ProfileSearchResult[];
  failed: boolean;
  retry: () => void;
}) {
  if (failed) {
    return (
      <section style={{ marginTop: 16 }}>
        <div className="ios-card" style={{ padding: 16 }} role="alert">
          <div className="ios-hl">Couldn’t Search Players</div>
          <button type="button" className="ios-cl ios-acc ios-md" style={{ border: 0, padding: 0, background: "none", cursor: "pointer", marginTop: 2 }} onClick={retry}>
            Try Again
          </button>
        </div>
      </section>
    );
  }
  if (results.length === 0) return null;
  return (
    <section style={{ marginTop: 16 }}>
      <div className="ios-sect">
        <h2 className="ios-t3">Players</h2>
      </div>
      <div className="ios-list">
        {results.map((person) => (
          <Link
            key={person.id}
            href={`/players/${person.id}`}
            className="ios-row ios-link"
            style={{ padding: "8px 16px", "--ios-inset": "68px" } as React.CSSProperties}
          >
            <Monogram name={person.name} photoUrl={person.avatar_url} />
            <div className="ios-grow">
              <div className="ios-bd">{person.name || "Player"}</div>
              <div className="ios-fn ios-sec">{[person.skill_level, person.home_club].filter(Boolean).join(" · ")}</div>
            </div>
            <span className="ios-chev">
              <Icon name="chevron-right" size={13} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function DiscoverScreen() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [games, setGames] = useState<Game[]>([]);
  const [own, setOwn] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [viewerInitials, setViewerInitials] = useState("");
  const [now, setNow] = useState(0);
  const [view, setView] = useState<View>({ ...CLEAR, dates: DEFAULT_DATES });
  const [stored] = useState(readStored);
  const restoreY = useRef(0);
  const viewRef = useRef(view);
  const players = usePlayerSearch(view.query);

  const change = (patch: Partial<View>) => setView((v) => ({ ...v, ...patch }));

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      try {
        const [all, ownIds, me, connections] = await Promise.all([
          loadGames(),
          uid ? getJoinedOrCreatedGameIds(uid) : Promise.resolve([] as string[]),
          uid ? getProfile(uid) : Promise.resolve(null),
          // Only one filter needs these, so a failure mustn't cost the whole list.
          uid ? getConnections(uid).catch(() => []) : Promise.resolve([]),
        ]);
        if (!active) return;
        if (stored) {
          const { y, ...savedView } = stored;
          restoreY.current = y;
          setView(savedView);
        } else {
          // A player sees their own level first, as the mockup shows.
          setView((v) => ({ ...v, level: tierOfPlayer(me?.skill_level) }));
        }
        setGames(all);
        setOwn(new Set(ownIds));
        setConnected(new Set(connections.map((p) => p.id)));
        setUserId(uid);
        setViewerInitials(initialsFrom(me?.name));
        setNow(Date.now());
        setFailed(false);
      } catch {
        if (!active) return;
        setFailed(true);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [attempt, stored]);

  // Return to the same place in the list once it has drawn.
  useLayoutEffect(() => {
    if (loading || restoreY.current === 0) return;
    window.scrollTo(0, restoreY.current);
    restoreY.current = 0;
  }, [loading]);

  // Remember the place on the way out, before the next page resets the scroll.
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useLayoutEffect(() => () => writeStored({ ...viewRef.current, y: window.scrollY }), []);

  const areas = useMemo(() => {
    const seen = new Set<string>();
    for (const g of games) if (g.area) seen.add(g.area);
    return [...seen].sort();
  }, [games]);

  // Everything except the date filter, so "later games" can be counted too.
  const candidates = useMemo(() => {
    const q = view.query.trim().toLowerCase();
    return games.filter(
      (g) =>
        !own.has(g.id) &&
        (view.level == null || skillTierOf(g) === view.level) &&
        (view.area == null || g.area === view.area) &&
        matchesTime(g, view.time) &&
        (!view.connectionsOnly || (g.createdBy != null && connected.has(g.createdBy))) &&
        (q === "" || g.venue.toLowerCase().includes(q) || (g.area ?? "").toLowerCase().includes(q)),
    );
  }, [games, own, connected, view.query, view.level, view.area, view.time, view.connectionsOnly]);

  const shown = useMemo(() => candidates.filter((g) => matchesDates(g, view.dates, now)), [candidates, view.dates, now]);
  const later = view.dates === DEFAULT_DATES ? candidates.length - shown.length : 0;

  const days = useMemo(() => {
    const groups: { heading: string; games: Game[] }[] = [];
    for (const game of shown) {
      const heading = dayHeading(game.startsAt, new Date(now));
      const last = groups[groups.length - 1];
      if (last?.heading === heading) last.games.push(game);
      else groups.push({ heading, games: [game] });
    }
    return groups;
  }, [shown, now]);

  const anyGames = games.some((g) => !own.has(g.id));

  return (
    <>
      <header className="ios-nav">
        <h1 className="ios-lt">Discover</h1>
        <Link href="/create" aria-label="New game" className="ios-gcap-i ios-glass ios-press" style={{ color: "var(--ios-label)" }}>
          <Icon name="plus" size={21} />
        </Link>
      </header>

      <SearchField value={view.query} onChange={(query) => change({ query })} />

      <div className="ios-chips">
        <FilterChip
          label="Level"
          allLabel="All Levels"
          value={view.level}
          options={LEVELS}
          active={view.level != null}
          onChange={(level) => change({ level })}
        />
        <FilterChip
          label={DEFAULT_DATES}
          value={view.dates}
          options={DATES}
          active={view.dates !== DEFAULT_DATES}
          onChange={(dates) => change({ dates: dates ?? DEFAULT_DATES })}
        />
        <FilterChip
          label="Area"
          allLabel="All Areas"
          value={view.area}
          options={areas}
          active={view.area != null}
          onChange={(area) => change({ area })}
        />
        <FilterChip
          label="Any Time"
          allLabel="Any Time"
          value={view.time}
          options={TIMES}
          active={view.time != null}
          onChange={(time) => change({ time })}
        />
        <button
          type="button"
          className="ios-chip ios-press"
          data-on={view.connectionsOnly}
          aria-pressed={view.connectionsOnly}
          onClick={() => change({ connectionsOnly: !view.connectionsOnly })}
        >
          Connections Only
        </button>
      </div>

      {view.query.trim() !== "" && <PlayerResults results={players.results} failed={players.failed} retry={players.retry} />}

      {loading ? (
        <div aria-hidden style={{ marginTop: 16 }}>
          <div className="ios-skel" style={{ height: 150, margin: "0 16px 10px" }} />
          <div className="ios-skel" style={{ height: 150, margin: "0 16px 10px" }} />
          <div className="ios-skel" style={{ height: 150, margin: "0 16px 10px" }} />
        </div>
      ) : failed ? (
        <div className="ios-card" style={{ marginTop: 16, padding: 20 }} role="alert">
          <div className="ios-t3">Couldn’t Load Games</div>
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
      ) : (
        <>
          {days.map((day, i) => (
            <section key={day.heading} style={{ marginTop: i === 0 ? 16 : 14 }}>
              <div className="ios-sect">
                <h2 className="ios-t3">{day.heading}</h2>
                <div className="ios-fn ios-sec">
                  {day.games.length} game{day.games.length === 1 ? "" : "s"}
                </div>
              </div>
              {day.games.map((game) => (
                <GameCard key={game.id} game={game} userId={userId} viewerInitials={viewerInitials} now={new Date(now)} />
              ))}
            </section>
          ))}

          {later > 0 && (
            <div style={{ display: "flex", margin: "14px 16px 0" }}>
              <button
                type="button"
                className="ios-pill ios-press"
                style={{ border: 0, cursor: "pointer" }}
                onClick={() => change({ dates: "All Dates" })}
              >
                Show {later} Later Game{later === 1 ? "" : "s"}
              </button>
            </div>
          )}

          {shown.length === 0 && later === 0 && players.results.length === 0 && (
            <div className="ios-card" style={{ marginTop: 16, padding: 20 }}>
              <div className="ios-t3">{anyGames ? "No Games Match" : "No Open Games Right Now"}</div>
              <div className="ios-sh ios-sec" style={{ marginTop: 4 }}>
                {anyGames ? "Try another level, date or area." : "New games appear here as soon as they’re posted."}
              </div>
              <div style={{ display: "flex", marginTop: 14 }}>
                {anyGames ? (
                  <button
                    type="button"
                    className="ios-pill ios-press"
                    style={{ border: 0, cursor: "pointer" }}
                    onClick={() => setView(CLEAR)}
                  >
                    Clear Filters
                  </button>
                ) : (
                  <Link href="/create" className="ios-pill ios-press">
                    <Icon name="plus" size={15} />
                    New Game
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
