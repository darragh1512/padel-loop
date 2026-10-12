import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame, formatGameTime } from "../../../games";
import ChatThread from "../chat-thread";
import { ChatPinButton } from "@/components/ChatPin";
import { ButtonLink } from "@/components/ui";

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
    // shell's bottom-nav padding. Painted with the same court-blue wall as
    // every other screen, so the messages read as notes pinned to it.
    // Centred to the same phone width as the rest of the app.
    <div className="fixed inset-0 z-40 pena-wall">
      <div className="mx-auto max-w-md h-full flex flex-col pt-[env(safe-area-inset-top)]">
        {/* Compact summary strip — venue, area · time, plus back + view game.
            A papel bar with an ink edge, like the bottom nav. */}
        <header className="relative shrink-0 flex items-center gap-3 px-4 py-3 border-b-2 border-tinta bg-papel text-tinta">
          <Link
            href="/chat"
            aria-label="Back to chats"
            className="pl-press pl-hit shrink-0 text-tinta/70 hover:text-tinta rounded-field focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-lima"
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
            <div className="t-display text-display-xs text-tinta truncate">
              {game.venue}
            </div>
            <div className="t-mono text-tiny text-tinta/70 truncate mt-1">
              {game.location} · {formatGameTime(game.game_time)}
            </div>
          </div>

          {/* Pin to the top of MY Chat tab — personal, nobody else sees it. */}
          <ChatPinButton kind="game" id={id} title={game.venue} />

          <ButtonLink
            href={`/games/${id}`}
            variant="secondary"
            size="sm"
            className="shrink-0"
          >
            View game
          </ButtonLink>
        </header>

        {/* The thread fills the rest of the height; composer pins to the bottom. */}
        <div className="flex-1 min-h-0">
          <ChatThread gameId={id} fullScreen redirectTo={`/games/${id}`} />
        </div>
      </div>
    </div>
  );
}
