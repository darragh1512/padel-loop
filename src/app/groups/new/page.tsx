"use client";
// Create a group: name it, pick people, then land straight in its chat.
// Reuses the same Field/Input form primitives as login/signup, and the
// shared MemberPicker for finding people (same search as /search).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import MemberPicker from "@/components/MemberPicker";
import PlayerAvatar from "@/components/PlayerAvatar";
import { Field, Input, PrimaryButton, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { createGroup, addGroupMember } from "../../groups";
import type { ProfileSearchResult } from "../../profiles";

export default function NewGroupPage() {
  const router = useRouter();

  // Creating a group requires an account — send logged-out visitors to login,
  // same route-protection pattern as /create.
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
    });
  }, [router]);

  const [name, setName] = useState("");
  const [picked, setPicked] = useState<ProfileSearchResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePick(person: ProfileSearchResult) {
    setPicked((list) =>
      list.some((p) => p.id === person.id) ? list : [...list, person],
    );
  }
  function removePicked(id: string) {
    setPicked((list) => list.filter((p) => p.id !== id));
  }

  async function handleCreate() {
    if (!userId || saving) return;
    if (name.trim().length === 0) {
      setError("Give the group a name.");
      return;
    }
    setSaving(true);
    setError(null);

    const result = await createGroup(name, userId);
    if ("error" in result) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // Add everyone picked. Best-effort: a failing add doesn't block the rest
    // or stop the group (already created) from opening.
    for (const person of picked) {
      await addGroupMember(result.id, person.id, userId);
    }

    router.push(`/groups/${result.id}/chat`);
  }

  return (
    <main className="px-5 pt-6 relative">
      <p className="t-mono text-micro text-papel/80 mt-2">Club noticeboard</p>
      <h1 className="t-display text-display-md text-papel mt-1.5">New group</h1>
      <p className="text-label font-medium text-papel/85 mt-1.5 mb-4">
        Name it, add your people.
      </p>

      <SectionLabel>Name</SectionLabel>
      <Field label="Group name" htmlFor="group-name">
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Saturday crew"
          maxLength={60}
        />
      </Field>

      <SectionLabel>Add members</SectionLabel>
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {picked.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => removePicked(person.id)}
              aria-label={`Remove ${person.name || "player"}`}
              className="flex items-center gap-2 pl-surface rounded-full pl-1 pr-3 py-1"
            >
              <PlayerAvatar
                userId={person.id}
                avatarUrl={person.avatar_url}
                name={person.name}
                className="size-6"
              />
              <span className="text-label font-semibold text-tinta">
                {person.name || "Player"}
              </span>
              <span aria-hidden className="text-tinta/45">
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      <MemberPicker excludeIds={picked.map((p) => p.id)} onPick={handlePick} />

      <p
        aria-live="polite"
        className={`text-center text-label font-semibold text-naranja-d mt-4 ${error ? "" : "hidden"}`}
      >
        {error}
      </p>

      <PrimaryButton className="mt-5" onClick={handleCreate} loading={saving}>
        Create group
      </PrimaryButton>

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
