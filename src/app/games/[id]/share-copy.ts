// The words on the link preview, in one place.
//
// The <meta> tags and the generated image are produced by two different
// requests — WhatsApp fetches the page, then fetches the image separately — so
// they read the database at two different moments. Sharing the copy helpers
// means they can still disagree about the NUMBER (that is unavoidable), but
// never about the wording or the rules for choosing it.

import { formatDay, formatTimeRange, isCancelled, isFull, type Game } from "@/lib/types";

/* The state a card is describing. Order matters: cancelled outranks
   everything (there is no game), then the organiser's own closure, then full.
   Same precedence the join button uses, so a preview never promises something
   the screen behind it refuses. */
export type ShareState = "cancelled" | "closed" | "full" | "open";

export function shareStateOf(game: Game): ShareState {
  if (isCancelled(game)) return "cancelled";
  if (game.isManuallyClosed) return "closed";
  if (isFull(game)) return "full";
  return "open";
}

/* The headline. The venue is the club name — the thing a Dublin player
   recognises at a glance in a busy group chat, and the only element that
   stays readable when the preview is rendered as a small thumbnail. */
export function shareTitle(game: Game): string {
  return game.venue;
}

/* The spots phrase. Deliberately says "of N" rather than a bare number: a
   cached preview WILL go stale, and "1 of 4 spots left" ages into something a
   reader can sanity-check against the live page, where "1 spot left!" just
   reads as a lie. */
export function spotsPhrase(game: Game): string {
  const state = shareStateOf(game);
  if (state === "cancelled") return "Cancelled";
  if (state === "closed") return "Closed to new players";

  const left = game.maxPlayers - game.players.length;
  if (left <= 0) return `Full · ${game.maxPlayers} of ${game.maxPlayers}`;
  return `${left} of ${game.maxPlayers} spots left`;
}

/* Date · time · level · spots — the description line under the title. */
export function shareDescription(game: Game): string {
  const when = `${formatDay(game)} · ${formatTimeRange(game)}`;
  const level = `Level ${game.levelMin.toFixed(1)}–${game.levelMax.toFixed(1)}`;

  if (shareStateOf(game) === "cancelled") {
    // Lead with the bad news; a scraper that reads only the first clause still
    // tells the truth.
    return `Cancelled · ${when} · ${game.venue}`;
  }
  return `${when} · ${level} · ${spotsPhrase(game)}`;
}

/* Just the when, for the image's second line. */
export function shareWhen(game: Game): string {
  return `${formatDay(game)} · ${formatTimeRange(game)}`;
}
