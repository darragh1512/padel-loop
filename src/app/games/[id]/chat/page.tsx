import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame, formatGameTime } from "../../../games";
import ChatThread from "../chat-thread";

// Full-screen, WhatsApp-style chat for one game. A "pushed" conversation view:
// the header's back button is how you leave, the bottom nav is intentionally
// not rendered, and the message input is pinned to the very bottom.
//
// Access is members-only — ChatThread does the canUserChat check and, because
// we pass redirectTo, sends non-members (and logged-out visitors) to the game
// detail page instead of showing the inline note.
//
// Always read fresh (the header summary reflects the live game row).
export const dynamic = "force-dynamic";

export default async function GameChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return (
    // Fixed overlay so the chat truly fills the screen, ignoring the app
    // shell's bottom-nav padding. Centred to the same phone width as the rest
    // of the app.
    <div className="fixed inset-0 z-40 bg-bone">
      <div className="mx-auto max-w-md h-full flex flex-col">
        {/* Compact summary strip — venue, area · time, plus back + view game. */}
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-line bg-surface">
          <Link
            href="/chat"
            aria-label="Back to chats"
            className="pl-press pl-hit shrink-0 text-ink-secondary hover:text-ink rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="text-title font-semibold text-ink truncate">
              {game.venue}
            </div>
            <div className="text-label text-ink-secondary truncate">
              {game.location} · {formatGameTime(game.game_time)}
            </div>
          </div>

          <Link
            href={`/games/${id}`}
            className="pl-press shrink-0 text-label font-medium text-ink bg-sunken hover:bg-sunken-strong rounded-pill px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            View game
          </Link>
        </header>

        {/* The thread fills the rest of the height; composer pins to the bottom. */}
        <div className="flex-1 min-h-0">
          <ChatThread gameId={id} fullScreen redirectTo={`/games/${id}`} />
        </div>
      </div>
    </div>
  );
}
