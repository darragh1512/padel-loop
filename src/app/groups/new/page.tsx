"use client";
// Create a group: name it, pick people, then land straight in its chat.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@/components/ios/Alert";
import Icon from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import Sheet, { useSheetClosing } from "@/components/ios/Sheet";
import MemberPicker from "@/components/MemberPicker";
import { lastPath } from "@/lib/navMemory";
import { getSignedInUser } from "@/lib/session";
import { addGroupMember, createGroup } from "../../groups";
import type { ProfileSearchResult } from "../../profiles";

export default function NewGroupPage() {
  const router = useRouter();

  // Creating a group requires an account, so signed-out visitors go to log in.
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    getSignedInUser().then(({ data }) => {
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
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const leave = useCallback(() => {
    if (lastPath()) router.back();
    else router.push("/chat");
  }, [router]);
  const [closing, close] = useSheetClosing(leave);

  function requestClose() {
    if (name.trim() !== "" || picked.length > 0) setConfirmingDiscard(true);
    else close();
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
      setError("Couldn’t create the group. Try again.");
      setSaving(false);
      return;
    }

    // Add everyone picked. Best-effort: a failing add doesn't block the rest or
    // stop the group (already created) from opening.
    for (const person of picked) {
      await addGroupMember(result.id, person.id, userId);
    }

    router.replace(`/groups/${result.id}/chat`);
  }

  return (
    <>
      <main className="ios" />
      <Sheet
        title="New Group"
        left={{ label: "Cancel", onPress: requestClose }}
        right={{ label: "Create", onPress: handleCreate, busy: saving }}
        closing={closing}
        onRequestClose={requestClose}
        after={
          <Alert
            open={confirmingDiscard}
            onClose={() => setConfirmingDiscard(false)}
            title="Discard This Group?"
            actions={[
              { label: "Keep Editing", bold: true, onPress: () => setConfirmingDiscard(false) },
              {
                label: "Discard",
                destructive: true,
                onPress: () => {
                  setConfirmingDiscard(false);
                  close();
                },
              },
            ]}
          />
        }
      >
        <div className="ios-list" style={{ marginTop: 12 }}>
          <label className="ios-row ios-sheet-row">
            <span className="ios-bd">Name</span>
            <input
              className="ios-field"
              value={name}
              maxLength={60}
              placeholder="e.g. Saturday crew"
              onChange={(e) => {
                setError(null);
                setName(e.target.value);
              }}
            />
          </label>
        </div>
        {error && (
          <div className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
            {error}
          </div>
        )}

        <div className="ios-sect" style={{ marginTop: 18 }}>
          <h2 className="ios-t3">Add Members</h2>
          {picked.length > 0 && <div className="ios-fn ios-sec">{picked.length} added</div>}
        </div>
        {picked.length > 0 && (
          <div className="ios-list" style={{ marginBottom: 12 }}>
            {picked.map((person) => (
              <div
                key={person.id}
                className="ios-row"
                style={{ padding: "8px 16px", "--ios-inset": "68px" } as React.CSSProperties}
              >
                <Monogram name={person.name} photoUrl={person.avatar_url} />
                <span className="ios-bd ios-grow ios-clip">{person.name || "Player"}</span>
                <button
                  type="button"
                  className="ios-search-btn"
                  style={{ color: "var(--ios-secondary)" }}
                  aria-label={`Remove ${person.name || "player"}`}
                  onClick={() => setPicked((list) => list.filter((p) => p.id !== person.id))}
                >
                  <Icon name="clear" size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
        <MemberPicker
          excludeIds={picked.map((p) => p.id)}
          onPick={(person) => setPicked((list) => (list.some((p) => p.id === person.id) ? list : [...list, person]))}
        />
      </Sheet>
    </>
  );
}
