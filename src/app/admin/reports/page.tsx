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
import { ButtonLink, EmptyState, ErrorState, SectionLabel, Skeleton } from "@/components/ui";
import { Flag } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  amIAdmin,
  getReports,
  setReportStatus,
  REPORT_REASONS,
  type ReportRow,
} from "@/app/reports";

const STATUSES = ["open", "reviewing", "closed"] as const;
type Status = (typeof STATUSES)[number];

function reasonLabel(value: string): string {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}

function when(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminReportsPage() {
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [tab, setTab] = useState<Status>("open");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  // A queue that failed to load must not read as a clean queue — that is
  // the one mistake a moderation screen cannot afford.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        if (active) {
          setAdmin(false);
          setChecking(false);
        }
        return;
      }
      const yes = await amIAdmin();
      if (!active) return;
      setAdmin(yes);
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, []);

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
    const result = await setReportStatus(id, status);
    if ("ok" in result) {
      // It leaves the list it was in.
      setReports((rows) => rows.filter((r) => r.id !== id));
    }
    setBusyId(null);
  }

  if (checking) {
    return (
      <main className="px-5 pt-6 relative">
        <Skeleton className="rounded-field h-9 w-48 mt-2" />
        <Skeleton className="rounded-card h-24 w-full mt-4" />
        <BottomNav />
      </main>
    );
  }

  // Deliberately not a redirect and not an error: this reveals nothing about
  // whether the page exists or who can see it.
  if (!admin) {
    return (
      <main className="px-5 pt-6 relative">
        <h1 className="t-display text-display-md text-papel mt-2">Nothing here</h1>
        <p className="text-body font-medium text-papel/85 mt-1.5">
          This page isn&rsquo;t available to your account.
        </p>
        <Link
          href="/"
          className="t-mono inline-block text-lima text-body mt-4 rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
        >
          ← Back home
        </Link>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="px-5 pt-6 relative">
      <h1 className="t-display text-display-md text-papel mt-2">Reports</h1>

      <div className="pl-surface flex rounded-full p-1 mt-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setLoading(true);
              setTab(s);
            }}
            className={`flex-1 text-center text-label py-2 rounded-full capitalize transition-colors duration-150 ease-out ${
              tab === s
                ? "bg-lima text-tinta font-extrabold border-[1.5px] border-tinta"
                : "text-tinta/70 font-semibold border-[1.5px] border-transparent"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="rounded-card h-28 w-full mt-4" />
      ) : failed ? (
        <div className="mt-4">
          <ErrorState
            title="Couldn't load the queue."
            body="Reports may be waiting — this is a loading failure, not an empty queue."
            onRetry={() => {
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          />
        </div>
      ) : reports.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Flag size={22} strokeWidth={2.2} />}
            title={`Nothing ${tab}.`}
            body="Reports land here as soon as somebody files one."
            action={
              <ButtonLink href="/" variant="secondary" size="sm">
                Back home
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <>
          <SectionLabel>
            {reports.length} {tab}
          </SectionLabel>
          <div className="flex flex-col gap-2.5">
            {reports.map((r) => (
              <div key={r.id} className="pl-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="t-mono text-micro tracking-[0.14em] text-naranja-d">
                    {reasonLabel(r.reason)}
                  </div>
                  <div className="t-mono text-[9px] tracking-[0.1em] text-tinta/55 whitespace-nowrap">
                    {when(r.createdAt)}
                  </div>
                </div>

                <p className="text-body font-extrabold text-tinta mt-1.5">
                  <Link
                    href={`/players/${r.reportedId}`}
                    className="underline underline-offset-2"
                  >
                    {r.reportedName ?? "Player"}
                  </Link>{" "}
                  <span className="font-medium text-tinta/60">reported by</span>{" "}
                  <Link
                    href={`/players/${r.reporterId}`}
                    className="underline underline-offset-2"
                  >
                    {r.reporterName ?? "Player"}
                  </Link>
                </p>

                {/* The evidence — the copy taken when the report was filed, so
                    it survives the message being deleted. */}
                {r.context === "message" && (
                  <div className="pl-surface rounded-field px-3 py-2 mt-2.5">
                    <div className="t-mono text-micro tracking-[0.12em] text-tinta/55">
                      Reported message
                    </div>
                    <p className="text-label font-medium text-tinta/80 mt-1 break-words">
                      {r.messageText ?? "(no copy stored)"}
                    </p>
                  </div>
                )}

                {r.details && (
                  <div className="mt-2.5">
                    <div className="t-mono text-micro tracking-[0.12em] text-tinta/55">
                      They said
                    </div>
                    <p className="text-label font-medium text-tinta/80 mt-1 break-words">
                      {r.details}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mt-3.5">
                  {STATUSES.filter((s) => s !== r.status).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => move(r.id, s)}
                      disabled={busyId === r.id}
                      className="t-mono flex-1 text-micro tracking-[0.12em] text-tinta border-2 border-tinta rounded-pill py-1.5 capitalize disabled:opacity-50 active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
                    >
                      {busyId === r.id ? "…" : `Mark ${s}`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <BottomNav />
    </main>
  );
}
