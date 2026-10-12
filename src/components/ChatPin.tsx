"use client";

// Pinning a chat to the top of your own Chat tab — the shared pieces.
//
//   PinToggle        the round pin button (lima = pinned, like an active chip)
//   PinLimitDialog   the "unpin one first" notice for a fourth pin
//   ChatPinButton    a self-contained PinToggle for the full-screen chat
//                    headers: it looks up who's signed in and their pins
//
// The Chat tab list uses PinToggle directly, because it already holds every
// pin in state and needs to re-sort the list when one changes.

import { useEffect, useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
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
}: {
  pinned: boolean;
  busy?: boolean;
  // The chat's name, for the screen-reader label.
  title: string;
  onToggle: () => void;
}) {
  const Icon = pinned ? PinOff : Pin;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${title}` : `Pin ${title} to the top`}
      className={`pl-press pl-hit size-9 shrink-0 rounded-card border-2 grid place-items-center transition-colors duration-150 ease-out disabled:opacity-60 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-lima ${
        pinned
          ? "bg-lima border-tinta text-tinta"
          : "bg-papel border-tinta/35 text-tinta/55 hover:bg-lima/40 hover:text-tinta hover:border-tinta"
      }`}
    >
      <Icon size={15} strokeWidth={2.4} aria-hidden />
    </button>
  );
}

export function PinLimitDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Pins are full">
      <p className="text-label font-medium text-tinta/70 mt-2">
        {PIN_LIMIT_MESSAGE} Tap the pin on any pinned chat to free up a spot.
      </p>
      <Button className="mt-5" onClick={onClose}>
        Got it
      </Button>
    </Dialog>
  );
}

// For the full-screen chat header. Renders nothing until it knows who's
// signed in, so there's never a pin button that can't work.
export function ChatPinButton({
  kind,
  id,
  title,
}: {
  kind: ChatKind;
  id: string;
  title: string;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [pins, setPins] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
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

  // The failure stamp clears itself after a few seconds.
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

    setBusy(true);
    const result = pinned
      ? await unpinChat(userId, kind, id)
      : await pinChat(userId, kind, id);
    setBusy(false);

    if ("error" in result) {
      if ("limit" in result && result.limit) setLimitOpen(true);
      else setError(result.error);
      return;
    }

    const next = new Set(pins);
    if (pinned) next.delete(key);
    else next.add(key);
    setPins(next);
  }

  return (
    <>
      <PinToggle pinned={pinned} busy={busy} title={title} onToggle={toggle} />
      <PinLimitDialog open={limitOpen} onClose={() => setLimitOpen(false)} />
      {/* A failed pin (network, etc.) — shown as a small stamp under the
          header rather than a dialog, since retrying is one tap. */}
      {error && (
        <p
          role="status"
          className="absolute right-4 top-full mt-2 z-10 t-mono text-micro tracking-[0.08em] text-papel bg-naranja-d rounded-field px-2.5 py-1.5"
        >
          {error}
        </p>
      )}
    </>
  );
}
