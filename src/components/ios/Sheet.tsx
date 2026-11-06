"use client";

// A sheet rising over the current screen, which recedes behind it. New Game,
// Edit Profile and Report all use this, so they move the same way.
//
// It attaches to the top of the page, so it never recedes along with the screen
// behind it, wherever it was opened from. Dragging its top dismisses it, and speed
// counts as well as distance: a quick flick dismisses however short the drag.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FLICK = 0.5; // points per millisecond
const DRAG_DISTANCE = 0.35; // share of the sheet's height
const CLOSE_MS = 300;

export type SheetAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

const noSubscribe = () => () => {};

/* Plays the closing animation, then calls `after`. */
export function useSheetClosing(after: () => void): [boolean, () => void] {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(after, CLOSE_MS);
  }, [after]);
  return [closing, close];
}

export function SheetToggle({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="ios-row ios-toggle-row" onClick={onChange}>
      <span className="ios-bd ios-grow">{label}</span>
      <span className="ios-toggle" data-on={on} />
    </button>
  );
}

export default function Sheet({
  title,
  left,
  right,
  closing = false,
  onRequestClose,
  children,
  after,
}: {
  title: string;
  left: SheetAction;
  right?: SheetAction; // the prominent action
  closing?: boolean;
  onRequestClose: () => void; // dragged or flicked away
  children: ReactNode;
  after?: ReactNode; // alerts, which sit above the sheet
}) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; time: number; dy: number } | null>(null);

  // Recede the screen behind from where it's currently scrolled to, and darken
  // the phone's bars to match the black around it.
  useEffect(() => {
    document.documentElement.style.setProperty("--ios-scroll", `${window.scrollY}px`);
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const before = metas.map((m) => m.content);
    metas.forEach((m) => {
      m.content = "#000000";
    });
    return () => metas.forEach((m, i) => {
      m.content = before[i];
    });
  }, []);

  function dragStart(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { y: e.clientY, time: e.timeStamp, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (sheet.current) sheet.current.style.transition = "none";
  }
  function dragMove(e: React.PointerEvent) {
    if (!drag.current || !sheet.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    sheet.current.style.transform = `translateY(${drag.current.dy}px)`;
  }
  function dragEnd(e: React.PointerEvent) {
    const moved = drag.current;
    drag.current = null;
    if (!moved || !sheet.current) return;
    const speed = moved.dy / Math.max(e.timeStamp - moved.time, 1);
    const dismiss = moved.dy > 4 && (speed > FLICK || moved.dy > sheet.current.offsetHeight * DRAG_DISTANCE);
    sheet.current.style.transition = "";
    sheet.current.style.transform = ""; // settles back, or carries on down if it closes
    if (dismiss) onRequestClose();
  }

  if (!inBrowser) return null;

  // The hidden marker stays where the sheet was opened. Without one, Next.js looks
  // for this page's first element and scrolls the screen behind to the wrong place.
  return (
    <>
      <span hidden />
      {createPortal(
        <div className="ios-sheet-root">
          <div
            ref={sheet}
            className="ios-sheet"
            data-closing={closing || undefined}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div
              className="ios-sheet-top"
              onPointerDown={dragStart}
              onPointerMove={dragMove}
              onPointerUp={dragEnd}
              onPointerCancel={dragEnd}
            >
              <div className="ios-grabber" />
              <div className="ios-sheet-nav">
                <button type="button" className="ios-sheet-btn ios-glass ios-press" onClick={left.onPress}>
                  {left.label}
                </button>
                <h1 className="ios-hl">{title}</h1>
                {right ? (
                  <button
                    type="button"
                    className="ios-sheet-btn ios-press"
                    data-prominent
                    disabled={right.disabled || right.busy}
                    aria-busy={right.busy || undefined}
                    onClick={right.onPress}
                  >
                    {right.label}
                  </button>
                ) : (
                  <span style={{ width: 72 }} />
                )}
              </div>
            </div>
            <div className="ios-sheet-scroll">{children}</div>
          </div>
          {after}
        </div>,
        document.body,
      )}
    </>
  );
}
