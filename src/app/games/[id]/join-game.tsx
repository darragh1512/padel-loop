"use client";
// The Join / Leave logic for a game, and the floating bar that presents it. It
// checks who is logged in, reads whether you're already in this game, and writes
// to the game_players table. Logged-out taps go to the login page.
//
// Motion: the button dips under the thumb, then "Join Game" turns into "You're
// In" with a tick. The page fills the court spot at the same moment.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@/components/ios/Alert";
import Icon from "@/components/ios/Icon";
import { capture } from "@/lib/analytics";
import { clearPendingJoin, hasPendingJoin, startAuthForJoin } from "@/lib/pendingIntent";
import { supabase } from "@/lib/supabaseClient";
import {
  GAME_FULL,
  getGamePlayers,
  getWaitlist,
  joinGame,
  joinWaitlist,
  leaveGame,
  leaveWaitlist,
  ordinal,
  waitlistPositionOf,
  wasRemovedFrom,
} from "../../games";

export function useJoinControl({
  gameId,
  priced,
  manuallyClosed = false,
  full = false,
}: {
  gameId: string;
  priced: boolean;
  // The creator stopped new joins by hand. Separate from `full` because
  // they are different situations: this one leaves spots unfilled.
  manuallyClosed?: boolean;
  // Every spot is genuinely taken.
  full?: boolean;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Leaving asks first — it gives up a spot that someone else can take
  // straight away, so it isn't reliably undoable.
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // Where this person sits in the queue, 1-based. null = not queued.
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  // Set when they came back from signing up and the game had filled in the
  // meantime. Their intent is honoured as far as it still can be: we say so
  // plainly and leave the queue in front of them.
  const [filledWhileAway, setFilledWhileAway] = useState(false);
  // The organiser removed this person. They can't rejoin or queue, so they
  // get a plain notice instead of a button the database would refuse.
  const [removed, setRemoved] = useState(false);
  // Guards the auto-join so it fires at most once per page load.
  const pendingHandled = useRef(false);

  // Re-read who's logged in and whether they're already in this game.
  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id ?? null;
    setUserId(uid);
    const [players, queue, wasRemoved] = await Promise.all([
      getGamePlayers(gameId),
      getWaitlist(gameId),
      uid ? wasRemovedFrom(gameId, uid) : Promise.resolve(false),
    ]);
    setJoined(uid != null && players.includes(uid));
    setQueuePosition(waitlistPositionOf(queue, uid));
    setRemoved(wasRemoved);
  }, [gameId]);

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  // Coming back from sign-up with a join still pending.
  //
  // WHAT HAPPENS IF THE GAME FILLED WHILE THEY WERE SIGNING UP: the intent
  // is honoured as far as it truthfully can be. We do NOT silently queue
  // them — joining a game and taking a place in a queue are different
  // commitments, and the second one should be their tap, not ours. So we
  // say what happened and leave the Join Waitlist button in front of them.
  // Same for a game that was closed or cancelled while they were away.
  //
  // The intent is cleared whatever the outcome, so a failed join can't
  // re-fire on the next render or the next visit.
  useEffect(() => {
    if (loading || pendingHandled.current) return;
    if (!userId || joined || removed || queuePosition != null) return;

    let intentParam: string | null = null;
    try {
      intentParam = new URLSearchParams(window.location.search).get("intent");
    } catch {
      intentParam = null;
    }
    if (!hasPendingJoin(gameId, intentParam)) return;

    pendingHandled.current = true;

    (async () => {
      // Re-check against live data, not the state we arrived with: the
      // whole point is that time passed while they were signing up.
      if (full || manuallyClosed) {
        setFilledWhileAway(true);
      } else {
        const result = await joinGame(gameId, userId);
        if ("error" in result) {
          // Lost a race for the last spot between render and click.
          setFilledWhileAway(true);
        } else {
          await refresh();
          router.refresh();
        }
      }

      clearPendingJoin();
      // Drop ?intent=join from the address bar so a refresh or a shared
      // copy of THIS url doesn't try to join all over again.
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("intent")) {
          url.searchParams.delete("intent");
          window.history.replaceState({}, "", url.toString());
        }
      } catch {
        // Address bar tidy-up only; the storage note is already cleared.
      }
    })();
  }, [loading, userId, joined, removed, queuePosition, gameId, full, manuallyClosed, refresh, router]);

  // Take a place in the queue for a full game.
  async function handleJoinWaitlist() {
    if (!userId) {
      router.push(startAuthForJoin(gameId));
      return;
    }
    setWorking(true);
    setError(null);
    const result = await joinWaitlist(gameId, userId);
    if ("error" in result) {
      setError(result.error);
      setWorking(false);
      return;
    }
    await refresh();
    setWorking(false);
    router.refresh(); // the roster shows the queue to the organiser
  }

  // Give up a place in the queue. No confirmation: nothing is lost that
  // can't be undone by queueing again, and the spot was never theirs.
  async function handleLeaveWaitlist() {
    if (!userId) return;
    setWorking(true);
    setError(null);
    const result = await leaveWaitlist(gameId, userId);
    if ("error" in result) {
      setError(result.error);
      setWorking(false);
      return;
    }
    await refresh();
    setWorking(false);
    router.refresh();
  }

  async function handleJoin() {
    if (!userId) {
      // Carry WHAT they were doing and WHERE into the auth flow, so they
      // come back to this game with the join still waiting rather than
      // being dumped on the home screen.
      router.push(startAuthForJoin(gameId));
      return;
    }
    setWorking(true);
    setError(null);
    const result = await joinGame(gameId, userId);
    if ("error" in result) {
      setError(result.error === GAME_FULL ? GAME_FULL : "Couldn’t take that spot. Try again.");
      setWorking(false);
      if (result.error === GAME_FULL) router.refresh(); // show the full game and its waitlist
      return;
    }
    // The bottom of the funnel. game_id is an id, priced is a boolean —
    // the venue name and the price itself are not sent.
    capture("game_joined", { game_id: gameId, priced });
    setJoined(true); // the court and button change now, not after the re-read
    // A short buzz where the phone's browser allows one. iPhones don't let
    // websites do this, so there it simply does nothing.
    navigator.vibrate?.(10);
    await refresh();
    setWorking(false);
    router.refresh(); // re-render the server page so the players list updates
  }

  async function handleLeave() {
    if (!userId) return;
    setWorking(true);
    setError(null);
    const result = await leaveGame(gameId, userId);
    if ("error" in result) {
      // leaveGame explains WHY when it refuses (creator, or a result exists);
      // show that sentence rather than a generic retry message, which would
      // invite them to try something that can never work.
      setError(result.error);
      setWorking(false);
      return;
    }
    setConfirmingLeave(false);
    setJoined(false);
    await refresh();
    setWorking(false);
    router.refresh(); // frees the spot in the roster and the counts
  }

  return {
    userId,
    joined,
    loading,
    working,
    error,
    confirmingLeave,
    setConfirmingLeave,
    queuePosition,
    filledWhileAway,
    removed,
    handleJoin,
    handleJoinWaitlist,
    handleLeaveWaitlist,
    handleLeave,
  };
}

export type JoinControl = ReturnType<typeof useJoinControl>;

/* What a player needs explained about why they can't simply join. Shown in the
   page, because the floating bar only has room for a line or two. */
export function joinExplanation(
  control: JoinControl,
  { full, manuallyClosed }: { full: boolean; manuallyClosed: boolean },
): string | null {
  if (control.loading || control.removed || control.joined) return null;
  if (control.queuePosition != null) {
    if (manuallyClosed) {
      return "The organiser closed this game, so nobody is being moved in right now. You keep your place if it reopens.";
    }
    return control.queuePosition === 1
      ? "You’re next. If someone drops out you’ll be moved straight in and told."
      : "If a spot opens you’ll be moved in automatically, in queue order.";
  }
  if (control.filledWhileAway) {
    return manuallyClosed
      ? "The organiser closed this game while you were signing up. Join the waitlist and you’ll have a place if it reopens."
      : "This game filled up while you were signing up. Join the waitlist and you’ll be moved in automatically if someone drops out.";
  }
  if (manuallyClosed) {
    return "The organiser has closed this game to new players. Join the waitlist and you’ll have a place if it reopens.";
  }
  if (full) return "This game is full. Join the waitlist and you’ll be moved in automatically if someone drops out.";
  return null;
}

/* The bar's button. Its width follows whichever label is showing, so it eases
   between "Join Game" and "You're In" rather than jumping. */
function BarButton({
  label,
  joined,
  tone,
  disabled,
  busy,
  ariaLabel,
  onPress,
}: {
  label: string;
  joined: boolean;
  tone: "fill" | "tint";
  disabled: boolean;
  busy: boolean;
  ariaLabel?: string;
  onPress: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const showing = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const label = showing.current;
    if (!label) return;
    const fit = () => {
      if (button.current) button.current.style.width = `${Math.ceil(label.offsetWidth) + 52}px`;
    };
    fit();
    // Measure again if the label changes size, such as when a font arrives.
    const watcher = new ResizeObserver(fit);
    watcher.observe(label);
    return () => watcher.disconnect();
  }, [joined, label]);

  return (
    <button
      ref={button}
      type="button"
      className="ios-bar-btn"
      data-tone={tone}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      onClick={onPress}
    >
      <span ref={joined ? undefined : showing} className="ios-bar-face" data-on={!joined}>
        {label}
      </span>
      <span ref={joined ? showing : undefined} className="ios-bar-face" data-on={joined}>
        You’re In
        <Icon name="check" size={15} />
      </span>
    </button>
  );
}

export function JoinBar({
  control,
  status,
  statusIsOpen,
  detail,
  isOrganiser,
  cancelled,
  full,
  manuallyClosed,
  hasResult,
}: {
  control: JoinControl;
  status: string; // "2 spots open", "Full" or "Closed"
  statusIsOpen: boolean;
  detail: string; // "€13 · Today, 20:00"
  // The creator is in the roster but cannot leave — they cancel from the menu.
  isOrganiser: boolean;
  cancelled: boolean;
  full: boolean;
  manuallyClosed: boolean;
  // A match result has been started for this game, which fixes its players.
  hasResult: boolean;
}) {
  const { joined, loading, working, removed, queuePosition } = control;
  const canQueue = !joined && (full || manuallyClosed);

  // Say which of the bar's states this is, most specific first.
  let title = status;
  let titleClass = statusIsOpen ? "ios-acc" : "";
  let sub = detail;
  let label: string | null = "Join Game";
  let tone: "fill" | "tint" = "fill";
  let onPress: () => void = control.handleJoin;

  if (cancelled) {
    title = "Cancelled";
    titleClass = "ios-destructive";
    sub = "This game is off. No need to turn up.";
    label = null;
  } else if (removed && !joined) {
    title = "Removed";
    sub = "The organiser removed you from this game.";
    label = null;
  } else if (queuePosition != null) {
    title = `${ordinal(queuePosition)} in Queue`;
    titleClass = "ios-acc";
    label = "Leave Queue";
    tone = "tint";
    onPress = control.handleLeaveWaitlist;
  } else if (canQueue) {
    label = "Join Waitlist";
    onPress = control.handleJoinWaitlist;
  } else if (joined) {
    onPress = () => control.setConfirmingLeave(true);
  }

  return (
    <>
      <div className="ios-joinbar ios-glass">
        <div className="ios-grow">
          <div className={`ios-hl ios-clip ${titleClass}`}>{title}</div>
          <div className="ios-fn ios-clip" style={{ color: "var(--ios-bar-sub)" }}>
            {sub}
          </div>
        </div>
        {label &&
          (loading ? (
            <div className="ios-skel" style={{ width: 132, height: 48, borderRadius: 24, flex: "none" }} aria-hidden />
          ) : (
            <BarButton
              label={label}
              joined={joined}
              tone={joined ? "tint" : tone}
              disabled={working || (joined && isOrganiser)}
              busy={working}
              ariaLabel={joined ? (isOrganiser ? "You’re in, as the organiser" : "You’re in. Leave this game") : undefined}
              onPress={onPress}
            />
          ))}
      </div>

      {control.error && (
        <div className="ios-toast ios-glass ios-fn" role="alert">
          {control.error}
        </div>
      )}

      {/* Confirm before giving up a spot — someone else can take it the moment
          it frees, so this isn't reliably undoable. */}
      <Alert
        open={control.confirmingLeave}
        onClose={() => {
          if (!working) control.setConfirmingLeave(false);
        }}
        title={hasResult ? "You Can’t Leave Now" : "Leave This Game?"}
        actions={
          hasResult
            ? [{ label: "OK", bold: true, onPress: () => control.setConfirmingLeave(false) }]
            : [
                { label: "Stay In", bold: true, disabled: working, onPress: () => control.setConfirmingLeave(false) },
                { label: "Leave", destructive: true, busy: working, onPress: control.handleLeave },
              ]
        }
      >
        {hasResult
          ? "This game already has a match result, so its players are fixed."
          : "Your spot opens up and someone else can take it. The organiser will be told, and you’ll drop out of the game chat."}
      </Alert>
    </>
  );
}
