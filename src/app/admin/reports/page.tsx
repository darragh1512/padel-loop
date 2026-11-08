"use client";

// The moderation queue. Open reports, with their context attached.
//
// THE GATE IS RLS, NOT THIS PAGE. The SELECT policy on `reports` is
// `reporter_id = auth.uid() or public.is_admin()`, so somebody who types this
// URL without the flag gets an empty list from the database — there is nothing
// here for a client-side check to leak. The admin check below only decides
// what to render, so a non-admin sees a plain "nothing here" instead of an
// empty moderation screen that implies they should have access.
//
// The flag itself is set by hand, in SQL:
//   update profiles set is_admin = true where id = '<uuid>';
// There is no UI for granting it on purpose.

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import MessageCard, { TryAgain } from "@/components/ios/MessageCard";
import PageTitle from "@/components/ios/PageTitle";
import { getSignedInUser } from "@/lib/session";
import { amIAdmin, getReports, setReportStatus, REPORT_REASONS, type ReportRow } from "@/app/reports";

const STATUSES = ["open", "reviewing", "closed"] as const;
type Status = (typeof STATUSES)[number];

const LABEL: Record<Status, string> = { open: "Open", reviewing: "Reviewing", closed: "Closed" };

function reasonLabel(value: string): string {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}

function when(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" });
}

function Skeleton() {
  return <div className="ios-skel" aria-hidden style={{ height: 160, margin: "16px 16px 0" }} />;
}

function Quote({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="ios-fn ios-sec">{label}</div>
      <p className="ios-sh" style={{ marginTop: 2, overflowWrap: "anywhere" }}>
        {text}
      </p>
    </div>
  );
}

export default function AdminReportsPage() {
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [tab, setTab] = useState<Status>("open");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [moveFailedId, setMoveFailedId] = useState<number | null>(null);
  // A queue that failed to load must not read as a clean queue — that is
  // the one mistake a moderation screen cannot afford.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSignedInUser();
      if (!data.user) {
        if (active) {
          setAdmin(false);
          setChecking(false);
        }
        return;
      }
      try {
        const yes = await amIAdmin();
        if (!active) return;
        setAdmin(yes);
        setCheckFailed(false);
      } catch {
        // Read as "not an admin", this would tell a moderator there's nothing here.
        if (!active) return;
        setCheckFailed(true);
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [checkAttempt]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!admin) return;
      try {
        const rows = await getReports(tab);
        if (!active) return;
        setReports(rows);
        setFailed(false);
      } catch {
        if (!active) return;
        setFailed(true);
      }
      if (!active) return;
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [admin, tab, attempt]);

  async function move(id: number, status: Status) {
    if (busyId) return;
    setBusyId(id);
    setMoveFailedId(null);
    const result = await setReportStatus(id, status);
    // It leaves the list it was in.
    if ("ok" in result) setReports((rows) => rows.filter((r) => r.id !== id));
    else setMoveFailedId(id);
    setBusyId(null);
  }

  if (checking) {
    return (
      <main className="ios">
        <PageTitle title="Reports" fallback="/" />
        <Skeleton />
        <BottomNav />
      </main>
    );
  }

  if (checkFailed) {
    return (
      <main className="ios">
        <PageTitle title="Reports" fallback="/" />
        <MessageCard
          alert
          title="Couldn’t Open Reports"
          body="Reports may be waiting. Check your connection and try again."
          action={
            <TryAgain
              onClick={() => {
                setChecking(true);
                setCheckAttempt((n) => n + 1);
              }}
            />
          }
        />
        <BottomNav />
      </main>
    );
  }

  // Deliberately not a redirect and not an error: this reveals nothing about
  // whether the page exists or who can see it.
  if (!admin) {
    return (
      <main className="ios">
        <header className="ios-nav">
          <h1 className="ios-lt">Nothing Here</h1>
        </header>
        <MessageCard
          title="Not Available"
          body="This page isn’t available to your account."
          action={
            <Link href="/" className="ios-pill ios-press">
              Back to Home
            </Link>
          }
        />
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="ios">
      <PageTitle title="Reports" fallback="/" />

      <div className="ios-seg" role="group" aria-label="Show" style={{ margin: "10px 16px 0" }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={tab === s}
            onClick={() => {
              setLoading(true);
              setMoveFailedId(null);
              setTab(s);
            }}
          >
            {LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton />
      ) : failed ? (
        <MessageCard
          alert
          title="Couldn’t Load Reports"
          body="Reports may be waiting. This is a loading failure, not an empty queue."
          action={
            <TryAgain
              onClick={() => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
            />
          }
        />
      ) : reports.length === 0 ? (
        <MessageCard title={`Nothing ${LABEL[tab]}`} body="Reports land here as soon as someone files one." />
      ) : (
        <section style={{ marginTop: 16 }}>
          {reports.map((r) => (
            <div key={r.id} className="ios-card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <div className="ios-hl">{reasonLabel(r.reason)}</div>
                <div className="ios-fn ios-sec" style={{ whiteSpace: "nowrap" }}>
                  {when(r.createdAt)}
                </div>
              </div>

              <p className="ios-sh ios-sec" style={{ marginTop: 4 }}>
                <Link href={`/players/${r.reportedId}`} className="ios-link ios-acc ios-sb">
                  {r.reportedName ?? "Player"}
                </Link>{" "}
                reported by{" "}
                <Link href={`/players/${r.reporterId}`} className="ios-link ios-acc ios-sb">
                  {r.reporterName ?? "Player"}
                </Link>
              </p>

              {/* The evidence — the copy taken when the report was filed, so
                  it survives the message being deleted. */}
              {r.context === "message" && <Quote label="Reported Message" text={r.messageText ?? "No copy stored."} />}
              {r.details && <Quote label="They Said" text={r.details} />}

              {moveFailedId === r.id && (
                <p className="ios-fn ios-destructive" role="alert" style={{ marginTop: 10 }}>
                  Couldn’t update that report. Check your connection and try again.
                </p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                {STATUSES.filter((s) => s !== r.status).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="ios-wide-btn"
                    data-tone="tint"
                    style={{ height: 40, fontSize: 15 }}
                    disabled={busyId === r.id}
                    aria-busy={busyId === r.id || undefined}
                    onClick={() => move(r.id, s)}
                  >
                    Mark {LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <BottomNav />
    </main>
  );
}
