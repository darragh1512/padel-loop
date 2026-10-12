"use client";
// The interactive Join / Leave control for a game. It checks who is logged in,
// reads whether you're already in this game, and writes to the game_players
// table. Logged-out taps go to the login page.
//
// Sage belongs to joining — the screen's primary action. Leaving is the quiet
// secondary voice, never the loudest thing on the page.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Skeleton } from "@/components/ui";
import { capture } from "@/lib/analytics";
import {
  clearPendingJoin,
  hasPendingJoin,
  startAuthForJoin,
} from "@/lib/pendingIntent";
import { supabase } from "@/lib/supabaseClient";
import {
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

export default function JoinGame({
  gameId,
  priceLabel,
  manuallyClosed = false,
  full = false,
  createdBy,
  hasResult = false,
}: {
  gameId: string;
  // Already-formatted price per player, or null when none is set. Null
  // means the button says just "Count me in" — never a €0 or a stray €.
  priceLabel: string | null;
  // The creator stopped new joins by hand. Separate from `full` because
  // they are different situations: this one leaves spots unfilled.
  manuallyClosed?: boolean;
  // Every spot is genuinely taken.
  full?: boolean;
  // The game's creator. They are in the roster like everyone else, but
  // they cannot leave — they cancel the game instead.
  createdBy?: string;
  // A match result has been started for this game, which fixes its players.
  hasResult?: boolean;
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
  // say what happened and leave the Join waitlist button in front of them.
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
  }, [
    loading,
    userId,
    joined,
    removed,
    queuePosition,
    gameId,
    full,
    manuallyClosed,
    refresh,
    router,
  ]);

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
      setError("Couldn't take that spot. Give it another try.");
      setWorking(false);
      return;
    }
    // The bottom of the funnel. game_id is an id, priced is a boolean —
    // the venue name and the price itself are not sent.
    capture("game_joined", { game_id: gameId, priced: priceLabel != null });
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
    await refresh();
    setWorking(false);
    router.refresh(); // frees the spot in the roster and the counts
  }

  // While we check membership, hold the button's space with a matching
  // skeleton so the page doesn't jump when the real control arrives.
  if (loading) {
    return <Skeleton className="h-12 rounded-pill" />;
  }

  // Anyone already IN the game can always leave — closing a game stops new
  // people arriving, it doesn't trap the people already there.
  //
  // The two reasons are checked separately so the message is honest about
  // which one applies. Manual closing is named first: when the creator has
  // shut the game by hand that is what a player needs to be told, even if
  // it also happens to be full.
  // Can't take a spot right now — but for two DIFFERENT reasons, and the
  // queue behaves differently in each. Kept apart all the way to the copy:
  //
  //   full           — a real spot will open if somebody leaves, and the
  //                    database promotes the front of the queue when it does.
  //   manuallyClosed — the organiser filled the last spot OUTSIDE the app.
  //                    A departure here frees no real spot, so nobody is
  //                    promoted; the queue only matters if they reopen.
  //
  // Both can queue. Only the first is promised an automatic promotion,
  // because only the first is true.
  const canQueue = !joined && (full || manuallyClosed);

  // The creator is in the roster like everyone else, but Leave is not their
  // action — Cancel game is, and CreatorActions already offers it just above
  // this button. Showing them a Leave they cannot use would be a dead end,
  // so they get a line telling them which control they actually want.
  const isCreator = createdBy != null && userId != null && createdBy === userId;

  if (joined && isCreator) {
    return (
      <p className="text-center text-label font-medium text-papel/85">
        You are the organiser of this game. To pull it, use
        <span className="font-extrabold"> Cancel game</span> above — the whole
        game comes off and everyone is told.
      </p>
    );
  }

  // Removed by the organiser: say so plainly, and offer no way back in —
  // the database refuses both joining and queueing for this game.
  if (removed && !joined) {
    return (
      <div className="w-full rounded-card py-4 px-4 text-center bg-papel border-2 border-dashed border-naranja-d">
        <div className="t-mono text-label tracking-[0.14em] text-naranja-d">
          Removed
        </div>
        <div className="text-label font-medium text-tinta/70 mt-1">
          The organiser removed you from this game, so you can&apos;t rejoin it.
        </div>
      </div>
    );
  }

  // Already queued: show them their place and a way out of the queue.
  if (queuePosition != null) {
    return (
      <>
        <div className="rounded-card border-2 border-dashed border-papel/45 px-4 py-3 text-center">
          <div className="t-mono text-micro tracking-[0.14em] text-lima">
            {ordinal(queuePosition)} in queue
          </div>
          <p className="text-label font-medium text-papel/85 mt-1.5">
            {manuallyClosed
              ? "The organiser closed this game, so nobody is being moved in right now. You keep your place if it reopens."
              : queuePosition === 1
                ? "You're next. If someone drops out you'll be moved straight in and told."
                : "If a spot opens you'll be moved in automatically, in queue order."}
          </p>
        </div>
        <Button
          variant="secondary"
          className="mt-2"
          onClick={handleLeaveWaitlist}
          loading={working}
        >
          Leave the queue
        </Button>
        <p
          aria-live="polite"
          className={`text-center text-label font-semibold text-papel bg-naranja-d rounded-field px-3 py-1.5 mt-2 ${
            error ? "" : "hidden"
          }`}
        >
          {error}
        </p>
      </>
    );
  }

  return (
    <>
      <Button
        variant={joined ? "secondary" : "primary"}
        onClick={
          joined
            ? () => setConfirmingLeave(true)
            : canQueue
              ? handleJoinWaitlist
              : handleJoin
        }
        loading={working}
      >
        {joined
          ? "Leave game"
          : canQueue
            ? "Join waitlist"
            : priceLabel
              ? `Count me in · ${priceLabel}`
              : "Count me in"}
      </Button>
      {filledWhileAway && (
        <p className="text-center text-label font-semibold text-papel bg-naranja-d rounded-field px-3 py-2 mt-2">
          {manuallyClosed
            ? "The organiser closed this game while you were signing up."
            : "This game filled up while you were signing up."}
        </p>
      )}
      {canQueue && (
        <p className="text-center text-label font-medium text-papel/85 mt-2">
          {manuallyClosed
            ? "The organiser has closed this game to new players. Queue anyway and you'll have a place if it reopens."
            : "This game is full. Queue and you'll be moved in automatically if someone drops out."}
        </p>
      )}

      {/* Confirm before giving up a spot — someone else can take it the
          moment it frees, so this isn't reliably undoable. */}
      <Dialog
        open={confirmingLeave}
        onClose={() => !working && setConfirmingLeave(false)}
        title="Leave this game?"
      >
        <p className="text-label font-medium text-tinta/70 mt-2">
          {hasResult
            ? "This game already has a match result, so its players are fixed. You can't leave it now."
            : "Your spot goes back to the Loop and someone else can take it. The organiser will be told. You'll also drop out of the game chat."}
        </p>

        <div className="flex gap-2.5 mt-5">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setConfirmingLeave(false)}
            disabled={working}
          >
            {hasResult ? "Close" : "Stay in"}
          </Button>
          {!hasResult && (
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleLeave}
              loading={working}
            >
              Leave game
            </Button>
          )}
        </div>
      </Dialog>
      <p
        aria-live="polite"
        className={`text-center text-label font-semibold text-papel bg-naranja-d rounded-field px-3 py-1.5 mt-2 ${error ? "" : "hidden"}`}
      >
        {error}
      </p>
    </>
  );
}
