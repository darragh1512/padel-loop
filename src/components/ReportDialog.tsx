"use client";

// One report sheet, used from a player's profile and from a chat message.
// Same shape either way — only the context and the evidence differ.
//
// It offers to block at the same time, because a person who has just reported
// somebody usually also wants to stop seeing them, and making that a second
// journey through a second screen is how it ends up not happening. The switch is
// on by default for that reason, and can be turned off.
//
// The confirmation says the report was received and nothing about when anyone
// will look at it. Promising a response time you cannot keep is worse than
// promising nothing.

import { useCallback, useState } from "react";
import Icon from "@/components/ios/Icon";
import Sheet, { SheetToggle, useSheetClosing } from "@/components/ios/Sheet";
import { blockUser } from "@/app/blocks";
import {
  REPORT_REASONS,
  submitReport,
  type ReportContext,
  type ReportReason,
} from "@/app/reports";

export default function ReportDialog({
  open,
  ...props
}: {
  open: boolean;
  onClose: () => void;
  reporterId: string;
  reportedId: string;
  reportedName: string | null;
  context: ReportContext;
  messageId?: number;
  messageText?: string;
  // When they are already blocked there is nothing to offer.
  alreadyBlocked?: boolean;
  onBlocked?: () => void;
}) {
  // Only mounted while open, so each report starts clean.
  return open ? <ReportSheet {...props} /> : null;
}

function ReportSheet({
  onClose,
  reporterId,
  reportedId,
  reportedName,
  context,
  messageId,
  messageText,
  alreadyBlocked = false,
  onBlocked,
}: {
  onClose: () => void;
  reporterId: string;
  reportedId: string;
  reportedName: string | null;
  context: ReportContext;
  messageId?: number;
  messageText?: string;
  alreadyBlocked?: boolean;
  onBlocked?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [closing, close] = useSheetClosing(useCallback(() => onClose(), [onClose]));

  const who = reportedName ?? "this player";

  async function handleSubmit() {
    if (!reason || sending) return;
    setSending(true);
    setError(null);

    const result = await submitReport(reporterId, {
      reportedId,
      context,
      reason,
      details,
      messageId,
      messageText,
    });

    if ("error" in result) {
      setError(result.error);
      setSending(false);
      return;
    }

    // Blocking is secondary: if it fails, the report still went in and saying
    // otherwise would be wrong. The block can be retried from their profile.
    if (alsoBlock && !alreadyBlocked) {
      const blockResult = await blockUser(reporterId, reportedId);
      if ("ok" in blockResult) onBlocked?.();
    }

    setSent(true);
    setSending(false);
  }

  const requestClose = () => {
    if (!sending) close();
  };

  if (sent) {
    return (
      <Sheet
        title="Report Received"
        left={{ label: "Close", onPress: close }}
        closing={closing}
        onRequestClose={close}
      >
        <div className="ios-card ios-sh" style={{ marginTop: 12, padding: 16 }} role="status">
          Thanks. It’s with us and someone will look at it.
          {alsoBlock && !alreadyBlocked && ` You’ve also blocked ${who}, so they won’t show up for you any more.`}
          <div className="ios-sec" style={{ marginTop: 8 }}>
            We won’t tell {who} that you reported them.
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={context === "message" ? "Report Message" : `Report ${who}`}
      left={{ label: "Cancel", onPress: requestClose }}
      right={{ label: "Send", onPress: handleSubmit, disabled: reason == null, busy: sending }}
      closing={closing}
      onRequestClose={requestClose}
    >
      {context === "message" && messageText && (
        <div className="ios-card ios-sh ios-sec" style={{ marginTop: 12, padding: 16 }}>
          {messageText}
        </div>
      )}

      <div className="ios-sect" style={{ marginTop: 18 }}>
        <h2 className="ios-t3">What’s Wrong?</h2>
      </div>
      <div className="ios-list" role="radiogroup" aria-label="What’s wrong?">
        {REPORT_REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={reason === r.value}
            className="ios-row ios-toggle-row"
            onClick={() => setReason(r.value)}
          >
            <span className="ios-bd ios-grow">{r.label}</span>
            {reason === r.value && (
              <span className="ios-acc">
                <Icon name="check" size={16} />
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="ios-list" style={{ marginTop: 12 }}>
        <textarea
          className="ios-textarea"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Anything else? (Optional)"
          aria-label="Anything else?"
        />
      </div>

      {!alreadyBlocked && (
        <>
          <div className="ios-list" style={{ marginTop: 12 }}>
            <SheetToggle label={`Block ${who} as Well`} on={alsoBlock} onChange={() => setAlsoBlock((v) => !v)} />
          </div>
          <div className="ios-fn ios-sec" style={{ padding: "8px 32px 0" }}>
            They won’t be told, and they’ll disappear from your search, connections and chats.
          </div>
        </>
      )}

      {error && (
        <div className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
          {error}
        </div>
      )}
    </Sheet>
  );
}
