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
    <div className="fixed inset-0 z-40 bg-navy">
      <div className="mx-auto max-w-md h-full flex flex-col">
        {/* Compact summary strip — venue, area · time, plus back + view game. */}
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-navy/95 backdrop-blur-md">
          <Link
            href="/chat"
            aria-label="Back to chats"
            className="shrink-0 text-pale active:scale-90 transition-transform"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 5l-7 7 7 7"
                stroke="#c4d9ff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[14.5px] truncate">
              {game.venue}
            </div>
            <div className="text-[11.5px] text-dim font-light truncate">
              {game.location} · {formatGameTime(game.game_time)}
            </div>
          </div>

          <Link
            href={`/games/${id}`}
            className="shrink-0 text-[11.5px] font-medium text-sky bg-vivid/15 border border-sky/25 rounded-full px-3 py-1.5"
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
