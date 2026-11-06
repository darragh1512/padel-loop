"use client";

// Deleting your account. This is the one action in the app nothing can undo, so
// it sits behind a typed confirmation and can't be reached by a mis-tap.

import { useCallback, useState } from "react";
import Sheet, { useSheetClosing } from "@/components/ios/Sheet";
import { deleteMyAccount } from "../profiles";

function Facts({ title, items }: { title: string; items: string[] }) {
  return (
    <section style={{ marginTop: 16 }}>
      <div className="ios-sect">
        <h2 className="ios-t3">{title}</h2>
      </div>
      <div className="ios-card" style={{ padding: "12px 16px" }}>
        <ul className="ios-sh ios-sec" style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
          {items.map((item) => (
            <li key={item} style={{ marginTop: 4 }}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);
  const [closing, close] = useSheetClosing(useCallback(() => onClose(), [onClose]));

  function requestClose() {
    if (!deleting) close();
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(false);
    const result = await deleteMyAccount();
    if ("ok" in result) {
      // A full page load, so nothing from the deleted account stays on screen.
      window.location.href = "/";
      return;
    }
    // The whole deletion rolled back, so they still have a working account.
    setError(true);
    setDeleting(false);
  }

  return (
    <Sheet title="Delete Account" left={{ label: "Cancel", onPress: requestClose }} closing={closing} onRequestClose={requestClose}>
      <p className="ios-bd" style={{ padding: "12px 32px 0" }}>
        This can’t be undone.
      </p>

      <Facts
        title="Deleted for Good"
        items={[
          "Your login, name, photo and profile",
          "Your chat messages",
          "Your connections and notifications",
          "Your place in any game or waiting list",
        ]}
      />
      <Facts
        title="Kept, With Your Name Removed"
        items={[
          "Match results you played in. They’re the other three players’ record too, so they stay, showing you only as a past player.",
          "Games you organised that others joined. They’re handed to another player so the game still goes ahead.",
        ]}
      />

      <div className="ios-list" style={{ marginTop: 16 }}>
        <label className="ios-row ios-form-row" style={{ "--ios-label-w": "auto", gap: 12 } as React.CSSProperties}>
          <span className="ios-bd">Type DELETE</span>
          <input
            className="ios-input"
            value={typed}
            placeholder="to confirm"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <p className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
          Couldn’t delete your account. It’s still active, so please try again.
        </p>
      )}

      <div style={{ display: "flex", margin: "16px 16px 0" }}>
        <button
          type="button"
          className="ios-wide-btn"
          data-tone="destructive"
          disabled={deleting || typed.trim().toUpperCase() !== "DELETE"}
          aria-busy={deleting || undefined}
          onClick={handleDelete}
        >
          {deleting ? "Deleting…" : "Delete My Account"}
        </button>
      </div>
    </Sheet>
  );
}
