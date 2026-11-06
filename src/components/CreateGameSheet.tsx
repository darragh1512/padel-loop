"use client";

// The New Game sheet. It rises over the screen you were on, which recedes behind
// it. The same sheet proposes a game inside a group (the game then stays off
// Discover) and edits an existing game.
//
// Real data only. The mockup's "Players Already In" and "Connections Only" need
// things the app doesn't store yet, so they're left out for now. Game length and
// court number are optional: tapping the chosen length again clears it, and an
// empty court shows nothing on the game.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Alert from "@/components/ios/Alert";
import Court, { spotsFor } from "@/components/ios/Court";
import Icon from "@/components/ios/Icon";
import { getProfile } from "@/app/profiles";
import { createGame, updateGame } from "@/app/games";
import { initialsFrom, loadGames } from "@/lib/data";
import { previousPath } from "@/lib/navMemory";
import { supabase } from "@/lib/supabaseClient";
import { dublinDateKey, dublinToUtc } from "@/lib/time";
import { parsePriceInput, tierOfPlayer } from "@/lib/types";
import { shortDate } from "@/lib/when";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const LENGTHS = [60, 90, 120];
const DAY_MS = 86_400_000;
const FLICK = 0.5; // points per millisecond: faster than this dismisses, however short the drag
const DRAG_DISTANCE = 0.35; // or dragging past this share of the sheet

export type GameToEdit = {
  gameId: string;
  venue: string;
  area: string;
  date: string; // YYYY-MM-DD on the Dublin clock
  time: string; // HH:mm on the Dublin clock
  level: string;
  maxPlayers: number;
  price: string;
  minutes: number | null;
  court: string;
  players: { id: string; initials: string }[];
};

type Form = {
  venue: string;
  area: string;
  date: string;
  time: string;
  size: number;
  minutes: number | null;
  court: string;
  level: string;
  price: string;
  weekly: boolean;
};

const noSubscribe = () => () => {};

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="ios-row ios-toggle-row" onClick={onChange}>
      <span className="ios-bd ios-grow">{label}</span>
      <span className="ios-toggle" data-on={on} />
    </button>
  );
}

function Segments({
  label,
  options,
  value,
  disabled,
  onPick,
  width,
}: {
  label: string;
  options: number[];
  value: number | null;
  disabled?: (option: number) => boolean;
  onPick: (option: number) => void;
  width: number;
}) {
  return (
    <div className="ios-seg" role="group" aria-label={label} style={{ width }}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          disabled={disabled?.(option)}
          onClick={() => onPick(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default function CreateGameSheet({ groupId, editing }: { groupId?: string; editing?: GameToEdit }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [initials, setInitials] = useState("");
  const [recent, setRecent] = useState<{ venue: string; area: string }[]>([]);
  const [form, setForm] = useState<Form>(() => ({
    venue: editing?.venue ?? "",
    area: editing?.area ?? "",
    date: editing?.date ?? "",
    time: editing?.time ?? "19:00",
    size: editing?.maxPlayers ?? 4,
    minutes: editing ? editing.minutes : 90,
    court: editing?.court ?? "",
    level: editing?.level ?? "Intermediate",
    price: editing?.price ?? "",
    weekly: false,
  }));
  const [touched, setTouched] = useState(false);
  const [view, setView] = useState<"form" | "club">("form");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [closing, setClosing] = useState(false);

  // The sheet attaches to the top of the page, so it never recedes along with
  // the screen behind it, wherever it was opened from.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; time: number; dy: number } | null>(null);

  const change = (patch: Partial<Form>) => {
    setTouched(true);
    setProblem(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  // Who's creating this, and sensible starting values from what we know of them.
  // Creating a game needs an account, so signed-out visitors go to log in.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      const [me, games] = await Promise.all([
        getProfile(data.user.id),
        loadGames().catch(() => []),
      ]);
      if (!active) return;
      const seen = new Map<string, { venue: string; area: string }>();
      for (const g of games) if (g.area && !seen.has(g.venue)) seen.set(g.venue, { venue: g.venue, area: g.area });
      setRecent([...seen.values()].slice(0, 6));
      setInitials(initialsFrom(me?.name));
      if (editing) return;
      const club = me?.home_club?.trim() ?? "";
      const tomorrow = dublinDateKey(new Date(Date.now() + DAY_MS));
      setForm((f) => ({
        ...f,
        date: f.date || tomorrow,
        level: tierOfPlayer(me?.skill_level) ?? f.level,
        venue: f.venue || club,
        area: f.area || seen.get(club)?.area || "",
      }));
    })();
    return () => {
      active = false;
    };
  }, [router, editing]);

  // Recede the screen behind from where it's currently scrolled to, and darken
  // the phone's bars to match the black around it.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--ios-scroll", `${window.scrollY}px`);
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const before = metas.map((m) => m.content);
    metas.forEach((m) => {
      m.content = "#000000";
    });
    return () => metas.forEach((m, i) => {
      m.content = before[i];
    });
  }, []);

  function leave() {
    if (previousPath()) router.back();
    else router.push(editing ? `/games/${editing.gameId}` : groupId ? `/groups/${groupId}/chat` : "/");
  }

  function close() {
    if (sheet.current) sheet.current.style.transform = "";
    setClosing(true);
    setTimeout(leave, 300);
  }

  function requestClose() {
    if (touched) {
      if (sheet.current) {
        sheet.current.style.transition = "";
        sheet.current.style.transform = "";
      }
      setConfirmDiscard(true);
    } else {
      close();
    }
  }

  async function submit() {
    if (!userId || saving) return;
    if (!form.venue.trim() || !form.area.trim()) {
      setProblem("Add the club and its area.");
      setView("club");
      return;
    }
    if (!form.date || !form.time) {
      setProblem("Choose a date and time.");
      return;
    }
    // Checked before anything is sent, so a bad price can never reach the
    // database. Blank is fine: it means no price is set.
    const price = parsePriceInput(form.price);
    if ("error" in price) {
      setProblem(price.error);
      return;
    }
    // The typed date and time are Dublin clock values; store the true instant.
    const game_time = dublinToUtc(form.date, form.time);
    if (!editing && new Date(game_time).getTime() <= Date.now()) {
      setProblem("Choose a time in the future.");
      return;
    }
    const details = {
      venue: form.venue.trim(),
      location: form.area.trim(),
      game_time,
      skill_level: form.level,
      max_players: form.size,
      price_per_player: price.value,
      duration_mins: form.minutes,
      court_number: form.court.replace(/^court\s*/i, "").trim() || null,
    };

    setSaving(true);
    setProblem(null);
    if (editing) {
      const result = await updateGame(editing.gameId, details);
      if ("error" in result) {
        setProblem("Couldn’t save your changes. Try again.");
        setSaving(false);
        return;
      }
      router.replace(`/games/${editing.gameId}`);
      router.refresh(); // show the updated row
      return;
    }
    const result = await createGame({ ...details, group_id: groupId, recurs_weekly: form.weekly }, userId);
    if ("id" in result) {
      router.replace(groupId ? `/groups/${groupId}/chat` : `/games/${result.id}`);
    } else {
      setProblem("Couldn’t post the game. Try again.");
      setSaving(false);
    }
  }

  /* Dragging the top of the sheet. Speed decides as well as distance, so a quick
     flick dismisses it however short the drag was. */
  function dragStart(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { y: e.clientY, time: e.timeStamp, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (sheet.current) sheet.current.style.transition = "none";
  }
  function dragMove(e: React.PointerEvent) {
    if (!drag.current || !sheet.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    sheet.current.style.transform = `translateY(${drag.current.dy}px)`;
  }
  function dragEnd(e: React.PointerEvent) {
    const moved = drag.current;
    drag.current = null;
    if (!moved || !sheet.current) return;
    const speed = moved.dy / Math.max(e.timeStamp - moved.time, 1);
    sheet.current.style.transition = "";
    if (moved.dy > 4 && (speed > FLICK || moved.dy > sheet.current.offsetHeight * DRAG_DISTANCE)) {
      requestClose();
    } else {
      sheet.current.style.transform = ""; // settle back into place
    }
  }

  const players = editing?.players ?? (userId ? [{ id: userId, initials: initials || " " }] : []);
  const sizes = [...new Set([2, 4, form.size])].sort((a, b) => a - b);
  const lengths = [...new Set([...LENGTHS, ...(form.minutes ? [form.minutes] : [])])].sort((a, b) => a - b);
  const title = editing ? "Edit Game" : groupId ? "Propose Game" : "New Game";
  const action = editing ? "Save" : groupId ? "Propose" : "Post";

  if (!inBrowser) return null;

  // The hidden marker stays where the sheet was opened. Without one, Next.js looks
  // for this page's first element and scrolls the screen behind to the wrong place.
  return (
    <>
      <span hidden />
      {createPortal(
    <div className="ios-sheet-root">
      <div
        ref={sheet}
        className="ios-sheet"
        data-closing={closing || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="ios-sheet-top" onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd}>
          <div className="ios-grabber" />
          {view === "form" ? (
            <div className="ios-sheet-nav">
              <button type="button" className="ios-sheet-btn ios-glass ios-press" onClick={requestClose}>
                Cancel
              </button>
              <h1 className="ios-hl">{title}</h1>
              <button
                type="button"
                className="ios-sheet-btn ios-press"
                data-prominent
                disabled={saving}
                aria-busy={saving || undefined}
                onClick={submit}
              >
                {action}
              </button>
            </div>
          ) : (
            <div className="ios-sheet-nav">
              <button type="button" className="ios-sheet-btn ios-glass ios-press" onClick={() => setView("form")}>
                Back
              </button>
              <h1 className="ios-hl">Club</h1>
              <button type="button" className="ios-sheet-btn ios-press" data-prominent onClick={() => setView("form")}>
                Done
              </button>
            </div>
          )}
        </div>

        <div className="ios-sheet-scroll">
          {view === "club" ? (
            <div className="ios-sheet-page" key="club">
              <div className="ios-list" style={{ marginTop: 12 }}>
                <label className="ios-row ios-sheet-row">
                  <span className="ios-bd">Club</span>
                  <input
                    className="ios-field"
                    autoFocus={!form.venue}
                    value={form.venue}
                    placeholder="Required"
                    onChange={(e) => change({ venue: e.target.value })}
                  />
                </label>
                <label className="ios-row ios-sheet-row">
                  <span className="ios-bd">Area</span>
                  <input
                    className="ios-field"
                    value={form.area}
                    placeholder="Required"
                    onChange={(e) => change({ area: e.target.value })}
                  />
                </label>
              </div>
              {problem && (
                <div className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
                  {problem}
                </div>
              )}
              {recent.length > 0 && (
                <>
                  <div className="ios-sect" style={{ marginTop: 18 }}>
                    <h2 className="ios-t3">Recent Clubs</h2>
                  </div>
                  <div className="ios-list">
                    {recent.map((club) => (
                      <button
                        key={club.venue}
                        type="button"
                        className="ios-row ios-toggle-row"
                        onClick={() => {
                          change({ venue: club.venue, area: club.area });
                          setView("form");
                        }}
                      >
                        <span className="ios-grow" style={{ textAlign: "left" }}>
                          <span className="ios-bd" style={{ display: "block" }}>{club.venue}</span>
                          <span className="ios-fn ios-sec" style={{ display: "block" }}>{club.area}</span>
                        </span>
                        {form.venue === club.venue && (
                          <span className="ios-acc">
                            <Icon name="check" size={16} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="ios-sheet-page" key="form">
              <div className="ios-list" style={{ marginTop: 12 }}>
                <div style={{ padding: "12px 12px 0" }}>
                  <Court
                    spots={spotsFor(players, form.size, null)}
                    big
                    radius={7}
                    label={`Court with ${players.length} of ${form.size} players in`}
                  />
                </div>
                <div className="ios-row" style={{ minHeight: 52, padding: "0 16px" }}>
                  <div className="ios-bd ios-grow">Players</div>
                  <Segments
                    label="Players"
                    options={sizes}
                    value={form.size}
                    width={96}
                    disabled={(size) => size < players.length}
                    onPick={(size) => change({ size })}
                  />
                </div>
              </div>

              <div className="ios-list" style={{ marginTop: 12 }}>
                <button type="button" className="ios-row ios-sheet-row ios-toggle-row" onClick={() => setView("club")}>
                  <span className="ios-rico"><Icon name="pin" size={22} /></span>
                  <span className="ios-bd ios-grow" style={{ textAlign: "left" }}>Club</span>
                  <span className="ios-bd ios-sec ios-clip" style={{ maxWidth: "55%" }}>{form.venue || "Choose"}</span>
                  <span className="ios-chev"><Icon name="chevron-right" size={13} /></span>
                </button>

                <div className="ios-row ios-sheet-row">
                  <span className="ios-rico"><Icon name="calendar" size={22} /></span>
                  <span className="ios-bd ios-grow">Starts</span>
                  <label className="ios-dpill">
                    {form.date ? shortDate(form.date) : "Date"}
                    <input
                      type="date"
                      aria-label="Date"
                      value={form.date}
                      onChange={(e) => change({ date: e.target.value })}
                    />
                  </label>
                  <label className="ios-dpill">
                    {form.time || "Time"}
                    <input
                      type="time"
                      aria-label="Time"
                      value={form.time}
                      onChange={(e) => change({ time: e.target.value })}
                    />
                  </label>
                </div>

                <div className="ios-row ios-sheet-row">
                  <span className="ios-rico"><Icon name="clock" size={22} /></span>
                  <span className="ios-bd ios-grow">Minutes</span>
                  <Segments
                    label="Game length in minutes"
                    options={lengths}
                    value={form.minutes}
                    width={150}
                    onPick={(minutes) => change({ minutes: form.minutes === minutes ? null : minutes })}
                  />
                </div>

                <label className="ios-row ios-sheet-row">
                  <span className="ios-rico"><Icon name="court" size={22} /></span>
                  <span className="ios-bd">Court</span>
                  <input
                    className="ios-field"
                    value={form.court}
                    maxLength={20}
                    placeholder="Optional"
                    onChange={(e) => change({ court: e.target.value })}
                  />
                </label>

                <label className="ios-row ios-sheet-row">
                  <span className="ios-rico"><Icon name="level" size={22} /></span>
                  <span className="ios-bd ios-grow">Level</span>
                  <span className="ios-bd ios-sec">{form.level}</span>
                  <span className="ios-chev"><Icon name="updown" size={15} /></span>
                  <select
                    className="ios-native-over"
                    aria-label="Level"
                    value={form.level}
                    onChange={(e) => change({ level: e.target.value })}
                  >
                    {LEVELS.map((level) => (
                      <option key={level}>{level}</option>
                    ))}
                  </select>
                </label>

                <label className="ios-row ios-sheet-row">
                  <span className="ios-rico"><Icon name="euro" size={22} /></span>
                  <span className="ios-bd" style={{ whiteSpace: "nowrap" }}>Price per Player</span>
                  <input
                    className="ios-field"
                    inputMode="decimal"
                    value={form.price ? `€${form.price}` : ""}
                    placeholder="Optional"
                    aria-invalid={problem != null && "error" in parsePriceInput(form.price)}
                    onChange={(e) => change({ price: e.target.value.replace(/€/g, "") })}
                  />
                </label>
              </div>

              {!editing && (
                <div className="ios-list" style={{ marginTop: 12 }}>
                  <Toggle label="Repeat Weekly" on={form.weekly} onChange={() => change({ weekly: !form.weekly })} />
                </div>
              )}

              {problem ? (
                <div className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
                  {problem}
                </div>
              ) : (
                <div className="ios-fn ios-sec" style={{ padding: "8px 32px 0" }}>
                  {editing
                    ? "Players see your changes straight away."
                    : groupId
                      ? "Only your group will see this."
                      : "Nearby players at this level will see it right away."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Alert
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={editing ? "Discard Your Changes?" : "Discard This Game?"}
        actions={[
          { label: "Keep Editing", bold: true, onPress: () => setConfirmDiscard(false) },
          {
            label: "Discard",
            destructive: true,
            onPress: () => {
              setConfirmDiscard(false);
              close();
            },
          },
        ]}
      />
    </div>,
    document.body,
      )}
    </>
  );
}
