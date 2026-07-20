"use client";
// Header actions for a group thread: add a member (search + pick, can add
// several without closing) and leave the group (confirm, then back to the
// chat list). Mirrors CreatorActions' self-contained dialog-state pattern
// (games/[id]/creator-actions.tsx) — RLS is the real gate either way, these
// are just the entry points.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import MemberPicker from "@/components/MemberPicker";
import { supabase } from "@/lib/supabaseClient";
import { addGroupMember, leaveGroup } from "../../../groups";
import type { ProfileSearchResult } from "../../../profiles";

export default function GroupThreadActions({
  groupId,
  memberIds,
  onMemberAdded,
}: {
  groupId: string;
  memberIds: string[]; // current members, so the picker excludes them
  onMemberAdded: () => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [justAddedIds, setJustAddedIds] = useState<string[]>([]);
  const [error, setError] = useState(false);

  async function handlePick(person: ProfileSearchResult) {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;

    const result = await addGroupMember(groupId, person.id, uid);
    if ("ok" in result) {
      setJustAddedIds((ids) => [...ids, person.id]);
      onMemberAdded();
    }
  }

  async function handleLeave() {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid || working) return;

    setWorking(true);
    setError(false);
    const result = await leaveGroup(groupId, uid);
    if ("ok" in result) {
      router.push("/chat");
    } else {
      setError(true);
      setWorking(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          aria-label="Add a member"
          onClick={() => {
            setJustAddedIds([]);
            setAdding(true);
          }}
          className="pl-press pl-hit size-9 rounded-pill border-[1.5px] border-tinta text-tinta flex items-center justify-center hover:bg-lima/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Leave group"
          onClick={() => setLeaving(true)}
          className="pl-press pl-hit size-9 rounded-pill border-[1.5px] border-dashed border-naranja-d text-naranja-d flex items-center justify-center hover:bg-naranja-d/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add to group">
        <div className="mt-3">
          <MemberPicker
            excludeIds={[...memberIds, ...justAddedIds]}
            onPick={handlePick}
          />
        </div>
        <Button variant="secondary" className="mt-4" onClick={() => setAdding(false)}>
          Done
        </Button>
      </Dialog>

      <Dialog
        open={leaving}
        onClose={() => !working && setLeaving(false)}
        title="Leave this group?"
      >
        <p className="text-label font-medium text-tinta/70 mt-2">
          You&apos;ll stop seeing its messages, and need to be added back in to
          rejoin.
        </p>
        <div className="flex gap-2.5 mt-5">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setLeaving(false)}
            disabled={working}
          >
            Stay
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleLeave}
            loading={working}
          >
            Leave group
          </Button>
        </div>
        <p
          aria-live="polite"
          className={`text-center text-label font-semibold text-naranja-d mt-3 ${error ? "" : "hidden"}`}
        >
          Couldn&apos;t leave the group. Please try again.
        </p>
      </Dialog>
    </>
  );
}
