"use client";

// One report dialog, used from a player's profile and from a chat message.
// Same shape either way — only the context and the evidence differ.
//
// It offers to block at the same time, because a person who has just reported
// somebody usually also wants to stop seeing them, and making that a second
// journey through a second screen is how it ends up not happening. The box is
// ticked by default for that reason, and can be unticked.
//
// The confirmation says the report was received and nothing about when anyone
// will look at it. Promising a response time you cannot keep is worse than
// promising nothing.

import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { blockUser } from "@/app/blocks";
import {
  REPORT_REASONS,
  submitReport,
  type ReportContext,
  type ReportReason,
} from "@/app/reports";

export default function ReportDialog({
  open,
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
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const who = reportedName ?? "this player";

  function reset() {
    setReason(null);
    setDetails("");
    setAlsoBlock(true);
    setError(null);
    setSent(false);
  }

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

  // ── Received ──
  if (sent) {
    return (
      <Dialog
        open={open}
        onClose={() => {
          reset();
          onClose();
        }}
        title="Report received"
      >
        <p className="text-label font-medium text-tinta/70 mt-2">
          Thanks — it&rsquo;s with us and someone will look at it.
          {alsoBlock && !alreadyBlocked ? (
            <> You&rsquo;ve also blocked {who}, so they won&rsquo;t show up for
            you any more.</>
          ) : null}
        </p>
        <p className="text-label font-medium text-tinta/55 mt-2">
          We won&rsquo;t tell {who} that you reported them.
        </p>

        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => {
            reset();
            onClose();
          }}
        >
          Done
        </Button>
      </Dialog>
    );
  }

  // ── The form ──
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (sending) return;
        reset();
        onClose();
      }}
      title={context === "message" ? "Report this message" : `Report ${who}`}
    >
      {context === "message" && messageText && (
        <div className="pl-surface rounded-field px-3 py-2 mt-2">
          <div className="t-mono text-micro tracking-[0.12em] text-tinta/55">
            The message
          </div>
          <p className="text-label font-medium text-tinta/80 mt-1 break-words line-clamp-4">
            {messageText}
          </p>
        </div>
      )}

      <p className="t-mono text-micro tracking-[0.12em] text-tinta/70 mt-3">
        What&rsquo;s wrong?
      </p>
      <div className="flex flex-col gap-1.5 mt-2">
        {REPORT_REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setReason(r.value)}
            aria-pressed={reason === r.value}
            className={`text-left text-label font-semibold rounded-field border-2 px-3 py-2 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja ${
              reason === r.value
                ? "bg-lima text-tinta border-tinta"
                : "bg-transparent text-tinta/75 border-tinta/25"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <label className="block mt-3">
        <span className="t-mono text-micro tracking-[0.12em] text-tinta/70">
          Anything else? (optional)
        </span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="What happened?"
          className="w-full mt-1.5 pl-surface rounded-field px-3.5 py-2.5 text-body font-medium text-tinta placeholder:text-tinta/40 outline-none focus:border-naranja resize-none"
        />
      </label>

      {!alreadyBlocked && (
        <button
          type="button"
          onClick={() => setAlsoBlock((v) => !v)}
          aria-pressed={alsoBlock}
          className="flex items-start gap-2.5 w-full text-left mt-3 rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
        >
          <span
            aria-hidden
            className={`shrink-0 mt-0.5 size-5 rounded-field border-2 border-tinta grid place-items-center text-tinta text-label font-extrabold ${
              alsoBlock ? "bg-lima" : "bg-transparent"
            }`}
          >
            {alsoBlock ? "✓" : ""}
          </span>
          <span className="text-label font-medium text-tinta/75">
            Block {who} as well — they won&rsquo;t be told, and they&rsquo;ll
            disappear from your search, connections and chats.
          </span>
        </button>
      )}

      <div className="flex gap-2.5 mt-5">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            reset();
            onClose();
          }}
          disabled={sending}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          onClick={handleSubmit}
          loading={sending}
          disabled={reason == null}
        >
          Send report
        </Button>
      </div>

      <p
        aria-live="polite"
        className={`text-center text-label font-semibold text-naranja-d mt-3 ${
          error ? "" : "hidden"
        }`}
      >
        {error}
      </p>
    </Dialog>
  );
}
