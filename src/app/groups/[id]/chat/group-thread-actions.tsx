"use client";
// The ⋯ menu for a group thread: add members (search and pick, several without
// closing) and leave the group (confirm, then back to the chats list). RLS is the
// real gate either way; these are just the entry points.

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Alert from "@/components/ios/Alert";
import Icon from "@/components/ios/Icon";
import Sheet, { useSheetClosing } from "@/components/ios/Sheet";
import MemberPicker from "@/components/MemberPicker";
import { getSignedInUser } from "@/lib/session";
import { addGroupMember, leaveGroup } from "../../../groups";
import type { ProfileSearchResult } from "../../../profiles";

function AddMembersSheet({
  groupId,
  memberIds,
  onMemberAdded,
  onClose,
}: {
  groupId: string;
  memberIds: string[];
  onMemberAdded: () => void;
  onClose: () => void;
}) {
  const [added, setAdded] = useState<ProfileSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [closing, close] = useSheetClosing(useCallback(() => onClose(), [onClose]));

  async function handlePick(person: ProfileSearchResult) {
    const { data } = await getSignedInUser();
    const uid = data.user?.id;
    if (!uid) return;
    setError(null);
    const result = await addGroupMember(groupId, person.id, uid);
    if ("ok" in result) {
      setAdded((list) => [...list, person]);
      onMemberAdded();
    } else {
      setError(`Couldn’t add ${person.name || "that player"}. Try again.`);
    }
  }

  return (
    <Sheet title="Add Members" left={{ label: "Done", onPress: close }} closing={closing} onRequestClose={close}>
      <div style={{ height: 4 }} />
      <MemberPicker excludeIds={[...memberIds, ...added.map((p) => p.id)]} onPick={handlePick} />
      {error && (
        <div className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
          {error}
        </div>
      )}
      {added.length > 0 && (
        <div className="ios-fn ios-sec" role="status" style={{ padding: "8px 32px 0" }}>
          Added {added.map((p) => p.name || "Player").join(", ")}.
        </div>
      )}
    </Sheet>
  );
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  function closeMenu() {
    setMenuOpen(false);
    button.current?.focus();
  }

  async function handleLeave() {
    const { data } = await getSignedInUser();
    const uid = data.user?.id;
    if (!uid || working) return;
    setWorking(true);
    setError(false);
    const result = await leaveGroup(groupId, uid);
    if ("ok" in result) {
      router.replace("/chat");
    } else {
      setError(true);
      setWorking(false);
    }
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className="ios-gcap-i ios-press"
        style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer" }}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
      >
        <Icon name="ellipsis" size={24} />
      </button>

      {/* Outside the glass capsule, which would otherwise trap the menu inside it. */}
      {menuOpen &&
        createPortal(
          <div className="ios-sheet-root">
            <button type="button" className="ios-menu-scrim" aria-label="Close menu" tabIndex={-1} onClick={closeMenu} />
            <div
              className="ios-menu ios-game-menu"
              role="menu"
              onKeyDown={(e) => {
                if (e.key === "Escape") closeMenu();
              }}
            >
              <button
                type="button"
                role="menuitem"
                autoFocus
                className="ios-menu-item"
                style={{ paddingLeft: 14 }}
                onClick={() => {
                  setMenuOpen(false);
                  setAdding(true);
                }}
              >
                Add Members
              </button>
              <button
                type="button"
                role="menuitem"
                className="ios-menu-item"
                style={{ paddingLeft: 14 }}
                data-destructive
                onClick={() => {
                  setMenuOpen(false);
                  setError(false);
                  setLeaving(true);
                }}
              >
                Leave Group
              </button>
            </div>
          </div>,
          document.body,
        )}

      {adding && (
        <AddMembersSheet
          groupId={groupId}
          memberIds={memberIds}
          onMemberAdded={onMemberAdded}
          onClose={() => setAdding(false)}
        />
      )}

      <Alert
        open={leaving}
        onClose={() => {
          if (!working) setLeaving(false);
        }}
        title="Leave This Group?"
        error={error ? "Couldn’t leave the group. Try again." : null}
        actions={[
          { label: "Stay", bold: true, disabled: working, onPress: () => setLeaving(false) },
          { label: "Leave", destructive: true, busy: working, onPress: handleLeave },
        ]}
      >
        You’ll stop seeing its messages, and need to be added back in to rejoin.
      </Alert>
    </>
  );
}
