"use client";

// Pinning a chat to the top of your own Chats tab — the shared pieces.
//
//   PinToggle        the pin button (tinted blue when pinned)
//   PinLimitDialog   the "unpin one first" notice for a fourth pin
//   ChatPinButton    a self-contained PinToggle for the conversation headers: it
//                    looks up who's signed in and their pins
//
// The Chats list uses PinToggle directly, because it already holds every pin in
// state and needs to re-sort the list when one changes.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Alert from "@/components/ios/Alert";
import Icon from "@/components/ios/Icon";
import { getSignedInUser } from "@/lib/session";
import {
  MAX_PINS,
  PIN_LIMIT_MESSAGE,
  getPinnedKeys,
  pinChat,
  pinKey,
  unpinChat,
  type ChatKind,
} from "@/app/chat-pins";

export function PinToggle({
  pinned,
  busy = false,
  title,
  onToggle,
  inHeader = false,
}: {
  pinned: boolean;
  busy?: boolean;
  // The chat's name, for the screen-reader label.
  title: string;
  onToggle: () => void;
  inHeader?: boolean;
}) {
  return (
    <button
      type="button"
      className={inHeader ? "ios-gcap-i ios-pin ios-press" : "ios-pin ios-press"}
      data-in-header={inHeader || undefined}
      onClick={onToggle}
      disabled={busy}
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${title}` : `Pin ${title} to the top`}
    >
      <Icon name="pushpin" size={inHeader ? 21 : 17} />
    </button>
  );
}

export function PinLimitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Alert open={open} onClose={onClose} title="Pins Are Full" actions={[{ label: "OK", bold: true, onPress: onClose }]}>
      {PIN_LIMIT_MESSAGE} Tap the pin on any pinned chat to free up a spot.
    </Alert>
  );
}

// For the conversation header. Renders nothing until it knows who's signed in,
// so there's never a pin button that can't work.
export function ChatPinButton({ kind, id, title }: { kind: ChatKind; id: string; title: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [pins, setPins] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSignedInUser();
      const uid = data.user?.id ?? null;
      if (!uid) return;
      const keys = await getPinnedKeys(uid);
      if (!active) return;
      setUserId(uid);
      setPins(keys);
    })();
    return () => {
      active = false;
    };
  }, []);

  // The failure note clears itself after a few seconds.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  if (!userId || !pins) return null;

  const key = pinKey(kind, id);
  const pinned = pins.has(key);

  async function toggle() {
    if (!userId || !pins || busy) return;
    setError(null);

    if (!pinned && pins.size >= MAX_PINS) {
      setLimitOpen(true);
      return;
    }

    // Instant: the pin changes on the tap, and the database is asked behind it.
    // If it says no, it changes back and the reason shows.
    const before = pins;
    const next = new Set(pins);
    if (pinned) next.delete(key);
    else next.add(key);
    setPins(next);
    setBusy(true);
    const result = pinned ? await unpinChat(userId, kind, id) : await pinChat(userId, kind, id);
    setBusy(false);

    if ("error" in result) {
      setPins(before);
      if ("limit" in result && result.limit) setLimitOpen(true);
      else setError(result.error);
    }
  }

  return (
    <>
      <PinToggle pinned={pinned} busy={busy} title={title} onToggle={toggle} inHeader />
      <PinLimitDialog open={limitOpen} onClose={() => setLimitOpen(false)} />
      {error &&
        createPortal(
          <div className="ios-sheet-root">
            <div className="ios-toast ios-glass ios-fn" role="status">
              {error}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
