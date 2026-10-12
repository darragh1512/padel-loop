"use client";
// Full-screen, WhatsApp-style chat for one GROUP — mirrors
// games/[id]/chat/page.tsx (back button, compact header strip, ChatThread
// filling the rest), but as a client component throughout.
//
// That's a deliberate difference from the game version: games/[id]/chat/page.tsx
// fetches its header data (getGame) in an async SERVER component, which works
// there because "games" is publicly readable. A group's name and membership
// are RLS-gated on auth.uid(), and a server component has no access to the
// visiting user's session — an unauthenticated fetch would just get blocked by
// RLS regardless of whether the visitor is really a member. So header data is
// fetched client-side instead, the same way ChatThread already does its own
// access check.
//
// Access itself is still members-only, enforced by ChatThread (redirectTo
// sends non-members back to the chat list) and, underneath that, by RLS.
//
// Phase 2: any group games (proposed via the header's "Propose a game" link)
// are fetched here and handed to ChatThread as inlineItems — rendered as the
// existing GameCard, merged into the message stream by when they were
// proposed (created_at), not by when they're happening (game_time).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GameCard from "@/components/GameCard";
import { getGamesForGroup } from "@/lib/data";
import type { Game } from "@/lib/types";
import ChatThread, {
  type InlineThreadItem,
} from "../../../games/[id]/chat-thread";
import GroupThreadActions from "./group-thread-actions";
import { ChatPinButton } from "@/components/ChatPin";
import {
  getGroup,
  getGroupMembers,
  type Group,
  type GroupMemberProfile,
} from "../../../groups";

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

  // Each proposed game becomes an inline card, positioned in the thread by
  // when it was proposed (createdAt), not when it's happening.
  const inlineItems: InlineThreadItem[] = groupGames.map((g, i) => ({
    id: `game-${g.id}`,
    createdAt: g.createdAt ?? g.startsAt,
    content: <GameCard key={`game-${g.id}`} game={g} delay={i * 50} />,
  }));

  return (
    // Same fixed overlay + court-blue wall as the game chat page — one shared
    // full-screen chat "shell" look, whichever kind of thread it is.
    <div className="fixed inset-0 z-40 pena-wall">
      <div className="mx-auto max-w-md h-full flex flex-col pt-[env(safe-area-inset-top)]">
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
              {group?.name ?? "Group chat"}
            </div>
            <div className="t-mono text-tiny text-tinta/70 truncate mt-1">
              {members ? `${memberCount} member${memberCount === 1 ? "" : "s"}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Pin to the top of MY Chat tab — personal, nobody else sees it. */}
            <ChatPinButton
              kind="group"
              id={groupId}
              title={group?.name ?? "this group"}
            />

            <Link
              href={`/groups/${groupId}/propose`}
              aria-label="Propose a game"
              className="pl-press pl-hit size-9 rounded-card border-2 border-tinta bg-papel text-tinta flex items-center justify-center hover:bg-lima/40 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-lima"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </Link>

            {members && (
              <GroupThreadActions
                groupId={groupId}
                memberIds={members.map((m) => m.id)}
                onMemberAdded={reloadMembers}
              />
            )}
          </div>
        </header>

        {/* The thread fills the rest of the height; composer pins to the bottom. */}
        <div className="flex-1 min-h-0">
          <ChatThread
            groupId={groupId}
            fullScreen
            redirectTo="/chat"
            inlineItems={inlineItems}
          />
        </div>
      </div>
    </div>
  );
}
