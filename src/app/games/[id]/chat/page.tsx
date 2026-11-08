import Link from "next/link";
import { notFound } from "next/navigation";
import ChatHeader from "@/components/ChatHeader";
import { ChatPinButton } from "@/components/ChatPin";
import Icon from "@/components/ios/Icon";
import { gameWhen } from "@/lib/when";
import { gameChatPinnable } from "../../../chat-pins";
import { getGameOrThrow } from "../../../games";
import ChatThread from "../chat-thread";

// Full-screen chat for one game. The tab bar isn't shown here, and the message
// box stays at the bottom.
//
// Access is members-only — ChatThread does the canUserChat check and sends
// non-members (and logged-out visitors) to the game's page.
//
// Always read fresh (the header reflects the live game row).
export const dynamic = "force-dynamic";

export default async function GameChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameOrThrow(id);
  if (!game) notFound();

  return (
    <main className="ios ios-chat">
      <ChatHeader
        title={game.venue}
        subtitle={[game.location, gameWhen(game.game_time)].filter(Boolean).join(" · ")}
      >
        {/* A cancelled or finished game's chat can't be pinned. */}
        {gameChatPinnable(game) && <ChatPinButton kind="game" id={id} title={game.venue} />}
        <Link href={`/games/${id}`} aria-label="View game" className="ios-gcap-i ios-press">
          <Icon name="info" size={22} />
        </Link>
      </ChatHeader>
      <ChatThread gameId={id} redirectTo={`/games/${id}`} />
    </main>
  );
}
