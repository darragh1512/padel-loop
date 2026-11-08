"use client";

// The New Game sheet. It rises over the screen you were on, which recedes behind
// it. The same sheet proposes a game inside a group (the game then stays off
// Discover) and edits an existing game.
//
// Real data only. The mockup's "Connections Only" needs things the app doesn't
// store yet, so it's left out for now. Game length and court number are optional:
// tapping the chosen length again clears it, and an empty court shows nothing on
// the game. "Players Already In" counts everyone already playing: anyone beyond
// the real players is a guest, a friend who isn't on the app but holds a spot.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@/components/ios/Alert";
import Court, { spotsFor } from "@/components/ios/Court";
import Icon from "@/components/ios/Icon";
import Sheet, { SheetToggle, useSheetClosing } from "@/components/ios/Sheet";
import { getProfile } from "@/app/profiles";
import { createGame, updateGame } from "@/app/games";
import { initialsFrom, loadGames } from "@/lib/data";
import { markJustPosted } from "@/lib/justPosted";
import { previousPath } from "@/lib/navMemory";
import { supabase } from "@/lib/supabaseClient";
import { dublinDateKey, dublinToUtc } from "@/lib/time";
import { parsePriceInput, tierOfPlayer } from "@/lib/types";
import { shortDate } from "@/lib/when";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const LENGTHS = [60, 90, 120];
const DAY_MS = 86_400_000;

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
  guests: number;
};

type Form = {
  venue: string;
  area: string;
  date: string;
  time: string;
  size: number;
  guests: number;
  minutes: number | null;
  court: string;
  level: string;
  price: string;
  weekly: boolean;
};

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
    guests: editing?.guests ?? 0,
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

  const leave = useCallback(() => {
    if (previousPath()) router.back();
    else router.push(editing ? `/games/${editing.gameId}` : groupId ? `/groups/${groupId}/chat` : "/");
  }, [router, editing, groupId]);
  const [closing, close] = useSheetClosing(leave);

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

  function requestClose() {
    if (touched) setConfirmDiscard(true);
    else close();
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
      guest_count: form.guests,
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
      if (!groupId) markJustPosted(result.id);
      router.replace(groupId ? `/groups/${groupId}/chat` : `/games/${result.id}`);
    } else {
      setProblem("Couldn’t post the game. Try again.");
      setSaving(false);
    }
  }

  const players = editing?.players ?? (userId ? [{ id: userId, initials: initials || " " }] : []);
  const alreadyIn = players.length + form.guests;
  const sizes = [...new Set([2, 4, form.size])].sort((a, b) => a - b);
  const lengths = [...new Set([...LENGTHS, ...(form.minutes ? [form.minutes] : [])])].sort((a, b) => a - b);
  const title = editing ? "Edit Game" : groupId ? "Propose Game" : "New Game";
  const action = editing ? "Save" : groupId ? "Propose" : "Post";

  return (
    <Sheet
      title={view === "form" ? title : "Club"}
      left={view === "form" ? { label: "Cancel", onPress: requestClose } : { label: "Back", onPress: () => setView("form") }}
      right={
        view === "form"
          ? { label: action, onPress: submit, busy: saving }
          : { label: "Done", onPress: () => setView("form") }
      }
      closing={closing}
      onRequestClose={requestClose}
      after={
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
      }
    >
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
                    spots={spotsFor(players, form.size, null, form.guests)}
                    big
                    radius={7}
                    label={`Court with ${alreadyIn} of ${form.size} spots taken`}
                  />
                </div>
                <div className="ios-row" style={{ minHeight: 52, padding: "0 16px" }}>
                  <div className="ios-bd ios-grow">Players Already In</div>
                  <div className="ios-bd ios-sb" aria-live="polite" style={{ marginRight: 2 }}>
                    {alreadyIn}
                  </div>
                  <div className="ios-stepper" role="group" aria-label="Players already in">
                    <button
                      type="button"
                      aria-label="One fewer player already in"
                      disabled={form.guests === 0}
                      onClick={() => change({ guests: form.guests - 1 })}
                    >
                      <Icon name="minus" size={15} />
                    </button>
                    <i aria-hidden />
                    <button
                      type="button"
                      aria-label="One more player already in"
                      disabled={alreadyIn >= form.size}
                      onClick={() => change({ guests: form.guests + 1 })}
                    >
                      <Icon name="plus" size={15} />
                    </button>
                  </div>
                </div>
                <div className="ios-row" style={{ minHeight: 52, padding: "0 16px" }}>
                  <div className="ios-bd ios-grow">Players</div>
                  <Segments
                    label="Players"
                    options={sizes}
                    value={form.size}
                    width={96}
                    disabled={(size) => size < players.length}
                    onPick={(size) => change({ size, guests: Math.min(form.guests, Math.max(size - players.length, 0)) })}
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
                  <SheetToggle label="Repeat Weekly" on={form.weekly} onChange={() => change({ weekly: !form.weekly })} />
                </div>
              )}

              {problem ? (
                <div className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
                  {problem}
                </div>
              ) : (
                <div className="ios-fn ios-sec" style={{ padding: "8px 32px 0" }}>
                  {form.guests > 0
                    ? "Guests hold a spot but aren’t on the app. If one joins, lower the number so nobody is counted twice."
                    : editing
                    ? "Players see your changes straight away."
                    : groupId
                      ? "Only your group will see this."
                      : "Nearby players at this level will see it right away."}
                </div>
              )}
            </div>
          )}
    </Sheet>
  );
}
