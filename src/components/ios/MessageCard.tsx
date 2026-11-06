// A card standing in for a list that has nothing to show, or couldn't load.

import type { ReactNode } from "react";

export default function MessageCard({
  title,
  body,
  action,
  alert = false,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="ios-card" style={{ marginTop: 16, padding: 20 }} role={alert ? "alert" : undefined}>
      <div className="ios-t3">{title}</div>
      <div className="ios-sh ios-sec" style={{ marginTop: 4 }}>
        {body}
      </div>
      {action && <div style={{ display: "flex", marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function TryAgain({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ios-pill ios-press" style={{ border: 0, cursor: "pointer" }} onClick={onClick}>
      Try Again
    </button>
  );
}
