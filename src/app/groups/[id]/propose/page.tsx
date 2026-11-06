"use client";
// "Propose a game" for one group — the same sheet as New Game, just pre-set to
// this group (group_id on insert, off-Discover, back to the group's thread on
// success). Any member can propose, matching phase 1's "any member" model —
// reachable only via the entry point inside the group thread.

import CreateGameSheet from "@/components/CreateGameSheet";
import { useParams } from "next/navigation";

export default function ProposeGroupGamePage() {
  const params = useParams<{ id: string }>();

  return (
    <>
      <main className="ios" />
      <CreateGameSheet groupId={params.id} />
    </>
  );
}
