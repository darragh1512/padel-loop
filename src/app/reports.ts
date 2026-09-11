// Reporting a player, from their profile or from one chat message.
//
// Who can read a report: the person who filed it, and an admin. NOT the person
// reported — the RLS policy has no clause for them, deliberately. Nothing in
// this file takes the reported person's point of view, and nothing should.
//
// The rate limits and the duplicate rules live in the database, not here. A
// limit enforced in the client stops nobody who can call the API directly; the
// job here is to turn the database's refusal into a sentence a person can read.

import { supabase } from "@/lib/supabaseClient";
import { DataError } from "@/lib/loadable";

export type ReportReason =
  | "abuse"
  | "harassment"
  | "spam"
  | "no_show"
  | "fake_profile"
  | "other";

// The picker, in the order it is shown. Wording is plain and concrete so the
// choice is obvious without a help page.
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "abuse", label: "Abusive or threatening" },
  { value: "harassment", label: "Won't leave me alone" },
  { value: "spam", label: "Spam or scam" },
  { value: "no_show", label: "Books in and doesn't turn up" },
  { value: "fake_profile", label: "Not who they say they are" },
  { value: "other", label: "Something else" },
];

export type ReportContext = "profile" | "message";

export type NewReport = {
  reportedId: string;
  context: ReportContext;
  reason: ReportReason;
  details?: string;
  // Message reports carry both the id and a copy of the text. The copy is the
  // evidence: messages are deleted outright when their author deletes their
  // account, so the pointer alone can end up pointing at nothing.
  messageId?: number;
  messageText?: string;
};

export async function submitReport(
  reporterId: string,
  report: NewReport,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("reports").insert({
    reporter_id: reporterId,
    reported_id: report.reportedId,
    context: report.context,
    message_id: report.context === "message" ? report.messageId ?? null : null,
    message_text: report.context === "message" ? report.messageText ?? null : null,
    reason: report.reason,
    details: report.details?.trim() ? report.details.trim() : null,
  });

  if (error) {
    console.error("Could not submit report:", error.message);

    // 23505 = one of the duplicate indexes. They have already reported this,
    // and telling them so is more useful than a retry prompt for something
    // that will never succeed.
    if (error.code === "23505") {
      return {
        error:
          report.context === "message"
            ? "You've already reported this message."
            : "You've already reported this player. We're still looking at it.",
      };
    }

    // The rate-limit trigger raises check_violation with a readable message,
    // so pass it through rather than flattening it to a generic failure.
    if (error.code === "23514" || /report/i.test(error.message)) {
      return { error: error.message };
    }

    return { error: "Couldn't send that report. Please try again." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// The moderation queue — admins only.
// ---------------------------------------------------------------------------

export type ReportRow = {
  id: number;
  reporterId: string;
  reporterName: string | null;
  reportedId: string;
  reportedName: string | null;
  context: ReportContext;
  messageId: number | null;
  messageText: string | null;
  reason: ReportReason;
  details: string | null;
  status: "open" | "reviewing" | "closed";
  createdAt: string;
};

/* Is the signed-in user an admin? Answered by the database function, which is
   also what the RLS policy uses — so this can never disagree with what the
   queue will actually return. */
export async function amIAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("Could not check admin:", error.message);
    return false;
  }
  return data === true;
}

/* The queue. RLS does the gating: a non-admin gets an empty list from the
   database itself, not from a check here. */
export async function getReports(
  status: "open" | "reviewing" | "closed" | "all" = "open",
): Promise<ReportRow[]> {
  let request = supabase
    .from("reports")
    .select(
      "id, reporter_id, reported_id, context, message_id, message_text, reason, details, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") request = request.eq("status", status);

  const { data, error } = await request;

  if (error) {
    console.error("Could not load reports:", error.message);
    throw new DataError("Could not load reports", error.message);
  }
  if (!data || data.length === 0) return [];

  // Names, in one more query — the same manual join the rest of the app uses.
  const ids = Array.from(
    new Set(data.flatMap((r) => [r.reporter_id as string, r.reported_id as string])),
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", ids);

  const nameById = new Map<string, string | null>();
  for (const p of profiles ?? []) {
    nameById.set(p.id as string, (p.name as string | null) ?? null);
  }

  return data.map((r) => ({
    id: r.id as number,
    reporterId: r.reporter_id as string,
    reporterName: nameById.get(r.reporter_id as string) ?? null,
    reportedId: r.reported_id as string,
    reportedName: nameById.get(r.reported_id as string) ?? null,
    context: r.context as ReportContext,
    messageId: (r.message_id as number | null) ?? null,
    messageText: (r.message_text as string | null) ?? null,
    reason: r.reason as ReportReason,
    details: (r.details as string | null) ?? null,
    status: r.status as ReportRow["status"],
    createdAt: r.created_at as string,
  }));
}

/* Move a report along. Admin-only, enforced by the UPDATE policy. */
export async function setReportStatus(
  reportId: number,
  status: "open" | "reviewing" | "closed",
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId);

  if (error) {
    console.error("Could not update report:", error.message);
    return { error: "Couldn't update that report." };
  }
  return { ok: true };
}
