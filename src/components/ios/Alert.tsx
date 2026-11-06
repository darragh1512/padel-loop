"use client";

// An iPhone-style alert, for the moments that need a decision before something
// that can't be undone, such as leaving or cancelling a game.

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type AlertAction = {
  label: string;
  onPress: () => void;
  bold?: boolean; // the safe choice, or the action the alert is about
  destructive?: boolean;
  disabled?: boolean;
  busy?: boolean;
};

export default function Alert({
  open,
  onClose,
  title,
  children,
  actions,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions: AlertAction[];
  error?: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="ios-alert-wrap" role="alertdialog" aria-modal="true" aria-label={title}>
      <button type="button" className="ios-alert-scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className="ios-alert">
        <div className="ios-alert-body">
          <div className="ios-hl">{title}</div>
          {children && <div className="ios-fn">{children}</div>}
          {error && (
            <div className="ios-fn ios-destructive" aria-live="polite">
              {error}
            </div>
          )}
        </div>
        <div className="ios-alert-actions">
          {actions.map((action, i) => (
            <button
              key={action.label}
              type="button"
              autoFocus={i === 0}
              className="ios-alert-btn"
              data-bold={action.bold}
              data-destructive={action.destructive}
              disabled={action.disabled || action.busy}
              aria-busy={action.busy || undefined}
              onClick={action.onPress}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
