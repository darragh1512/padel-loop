"use client";
// Full-screen chat for one GROUP. Its header data is fetched here in the browser
// because a group's name and membership are RLS-gated on the visitor's session,
// which a server component doesn't have.
//
// Access itself is members-only, enforced by ChatThread (redirectTo sends
// non-members back to the chats list) and, underneath that, by RLS.
//
// Games proposed in the group appear in the thread at the moment they were
// proposed (createdAt), not when they're happening.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ChatHeader from "@/components/ChatHeader";
import { ChatPinButton } from "@/components/ChatPin";
import Court, { spotsFor } from "@/components/ios/Court";
import Icon from "@/components/ios/Icon";
import { getGamesForGroup } from "@/lib/data";
import { isCancelled, slotsLeft, type Game } from "@/lib/types";
import { gameWhen, spotsOpenText } from "@/lib/when";
import ChatThread, { type InlineThreadItem } from "../../../games/[id]/chat-thread";
import { getGroup, getGroupMembers, type Group, type GroupMemberProfile } from "../../../groups";
import GroupThreadActions from "./group-thread-actions";

function ProposedGame({ game }: { game: Game }) {
  const open = slotsLeft(game);
  const cancelled = isCancelled(game);
  const status = cancelled ? "Cancelled" : game.isManuallyClosed ? "Closed" : open > 0 ? spotsOpenText(open) : "Full";
  return (
    <Link
      href={`/games/${game.id}`}
      className="ios-link ios-press ios-chat-game"
      aria-label={`Proposed game: ${gameWhen(game.startsAt)} at ${game.venue}, ${status}`}
    >
      <div style={{ width: 84, flex: "none" }}>
        <Court spots={spotsFor(game.players, game.maxPlayers, null, game.guestCount)} label="" />
      </div>
      <div className="ios-grow">
        <div className="ios-hl">{gameWhen(game.startsAt)}</div>
        <div className="ios-fn ios-sec">{game.area ? `${game.venue}, ${game.area}` : game.venue}</div>
        <div className={!cancelled && !game.isManuallyClosed && open > 0 ? "ios-fn ios-sb ios-acc" : "ios-fn ios-sec"}>
          {status}
        </div>
      </div>
      <span className="ios-chev">
        <Icon name="chevron-right" size={13} />
      </span>
    </Link>
  );
}

export default function GroupChatPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMemberProfile[] | null>(null);
  const [groupGames, setGroupGames] = useState<Game[]>([]);

  const reloadMembers = useCallback(() => {
    getGroupMembers(groupId).then(setMembers);
  }, [groupId]);

  useEffect(() => {
    getGroup(groupId).then(setGroup);
    reloadMembers();
    getGamesForGroup(groupId).then(setGroupGames);
  }, [groupId, reloadMembers]);

  const memberCount = members?.length ?? 0;
  const inlineItems: InlineThreadItem[] = groupGames.map((g) => ({
    id: `game-${g.id}`,
    createdAt: g.createdAt ?? g.startsAt,
    content: <ProposedGame game={g} />,
  }));

  return (
    <main className="ios ios-chat">
      <ChatHeader
        title={group?.name ?? "Group"}
        subtitle={members ? `${memberCount} member${memberCount === 1 ? "" : "s"}` : ""}
      >
        <ChatPinButton kind="group" id={groupId} title={group?.name ?? "this group"} />
        <Link href={`/groups/${groupId}/propose`} aria-label="Propose a game" className="ios-gcap-i ios-press">
          <Icon name="plus" size={21} />
        </Link>
        {members && (
          <GroupThreadActions groupId={groupId} memberIds={members.map((m) => m.id)} onMemberAdded={reloadMembers} />
        )}
      </ChatHeader>
      <ChatThread groupId={groupId} redirectTo="/chat" inlineItems={inlineItems} />
    </main>
  );
}
