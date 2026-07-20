"use client";
// "Propose a game" for one group — the same CreateGameForm as /create, just
// pre-set to this group (group_id on insert, off-Discover, redirects back to
// the group's thread instead of the game's own page on success). Any member
// can propose, matching phase 1's "any member" model — reachable only via the
// entry point inside the group thread, not linked anywhere else.

import BottomNav from "@/components/BottomNav";
import CreateGameForm from "@/components/CreateGameForm";
import { useParams } from "next/navigation";

export default function ProposeGroupGamePage() {
  const params = useParams<{ id: string }>();

  return (
    <main className="px-5 pt-6 relative">
      <CreateGameForm groupId={params.id} />
      <BottomNav />
    </main>
  );
}
