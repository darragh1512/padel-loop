"use client";

// A list row with actions behind it, revealed by swiping left, as in Mail and
// Messages. A short swipe reveals the buttons; a long swipe past most of the
// row runs the first one straight away. Tapping the row while it's open closes
// it instead of opening the chat.
//
// The buttons are real buttons in the page, so screen readers and keyboards
// reach them without swiping; focusing one opens the row so it's visible.

import { useRef, useState } from "react";

export type SwipeAction = {
  label: string;
  tone: "archive" | "destructive";
  onPress: () => void;
};

const ACTION_WIDTH = 84;

export default function SwipeRow({
  actions,
  open,
  onOpenChange,
  children,
}: {
  actions: SwipeAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const revealed = -ACTION_WIDTH * actions.length;
  const [drag, setDrag] = useState<number | null>(null); // offset while a finger is down
  const gesture = useRef<{ x: number; y: number; from: number; horizontal: boolean | null; id: number } | null>(null);
  const moved = useRef(false);
  const row = useRef<HTMLDivElement>(null);

  const offset = drag ?? (open ? revealed : 0);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    gesture.current = { x: e.clientX, y: e.clientY, from: open ? revealed : 0, horizontal: null, id: e.pointerId };
    moved.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.horizontal == null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!g.horizontal) {
        gesture.current = null; // a scroll, not a swipe
        return;
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    moved.current = true;
    const width = row.current?.offsetWidth ?? 400;
    // Free to the left, a little give to the right of closed.
    const next = Math.min(g.from + dx, 0);
    setDrag(Math.max(next, -width));
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId || drag == null) {
      setDrag(null);
      return;
    }
    const width = row.current?.offsetWidth ?? 400;
    const at = drag;
    setDrag(null);
    if (at < -width * 0.6 && actions[0]) {
      onOpenChange(false);
      actions[0].onPress(); // the long swipe
    } else {
      onOpenChange(at < revealed / 2);
    }
  }

  return (
    <div ref={row} className="ios-swipe" data-dragging={drag != null || undefined}>
      <div className="ios-swipe-actions" style={{ width: Math.max(-offset, -revealed) }}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className="ios-swipe-btn"
            data-tone={a.tone}
            onFocus={() => onOpenChange(true)}
            onClick={() => {
              onOpenChange(false);
              a.onPress();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="ios-swipe-front"
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gesture.current = null;
          setDrag(null);
        }}
        onClickCapture={(e) => {
          // A swipe isn't a tap, and a tap on an open row just closes it.
          if (moved.current || open) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
            if (open) onOpenChange(false);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
