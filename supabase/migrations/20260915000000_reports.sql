-- supabase/migrations/20260915000000_reports.sql
-- REPORTING: a player reports another player, from their profile or from one
-- chat message. Lands somewhere an admin can act on it.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- WHO CAN SEE A REPORT: the person who filed it, and an admin. Explicitly NOT
-- the person reported — the SELECT policy has no `reported_id = auth.uid()`
-- clause, for the same reason the blocks policy has no `blocked_id` clause. A
-- report somebody can discover is a report nobody will file.

-- ── a) the admin flag ────────────────────────────────────────────────────
-- Set by hand in the dashboard:
--   update profiles set is_admin = true where id = '<your uuid>';
-- There is no UI for granting it, on purpose — the only way to become an
-- admin is direct database access.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Reading profiles from inside a policy on another table risks recursion and
-- depends on that table's own RLS. A SECURITY DEFINER function sidesteps both:
-- it answers "is the caller an admin" without the caller needing to be able to
-- read the profiles row itself.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ── b) the table ─────────────────────────────────────────────────────────
create table if not exists public.reports (
  id           bigint generated always as identity primary key,
  reporter_id  uuid        not null,
  reported_id  uuid        not null,
  context      text        not null default 'profile',
  -- The message complained about, when the report came from a chat thread.
  -- No foreign key on purpose: a report must outlive its evidence.
  message_id   bigint,
  -- A SNAPSHOT of that message, taken when the report was filed. Without it a
  -- report can arrive at a moderator with nothing to look at: messages are
  -- hard-deleted when their author deletes their account, so the very person
  -- most likely to be reported can erase what they said. The copy is the
  -- evidence; message_id is only a pointer to where it used to live.
  message_text text,
  reason       text        not null,
  details      text,
  status       text        not null default 'open',
  created_at   timestamptz not null default now(),

  constraint reports_no_self       check (reporter_id <> reported_id),
  constraint reports_context_chk   check (context in ('profile', 'message')),
  constraint reports_status_chk    check (status in ('open', 'reviewing', 'closed')),
  constraint reports_reason_chk    check (reason in (
    'abuse',         -- abusive, threatening or aggressive
    'harassment',    -- unwanted contact after being asked to stop
    'spam',          -- advertising, scams, repeated junk
    'no_show',       -- repeatedly books in and does not turn up
    'fake_profile',  -- not who they say they are
    'other'
  )),
  -- A message report without a message is a report with no evidence.
  constraint reports_message_ctx_chk check (
    (context = 'message' and message_id is not null) or
    (context = 'profile' and message_id is null)
  ),
  constraint reports_details_len   check (details is null or char_length(details) <= 1000)
);

create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

create index if not exists reports_reporter_idx
  on public.reports (reporter_id, created_at desc);

-- ── c) RLS ───────────────────────────────────────────────────────────────
alter table public.reports enable row level security;

drop policy if exists "See your own reports, or all if admin" on public.reports;
create policy "See your own reports, or all if admin"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "Report as yourself" on public.reports;
create policy "Report as yourself"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- Only an admin moves a report through open → reviewing → closed. A reporter
-- cannot edit or withdraw one: the record of what was said matters more than
-- second thoughts, and a withdrawable report is a pressurable one.
drop policy if exists "Admins update report status" on public.reports;
create policy "Admins update report status"
  on public.reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No DELETE policy for anyone.

-- ── d) rate limiting ─────────────────────────────────────────────────────
-- In the database, because a client-side limit stops nobody who can call the
-- API directly.
--
-- Two shapes of abuse, two defences:
--   • Volume — one person firing reports at everybody. Capped by the trigger.
--   • Pile-on — one person reporting the SAME person over and over to make the
--     queue look damning. Capped by the partial unique index: one OPEN profile
--     report per pair, and one report per message ever. Once an admin closes
--     it, a genuine new incident can be reported again.
create unique index if not exists reports_one_open_profile_per_pair
  on public.reports (reporter_id, reported_id)
  where context = 'profile' and status <> 'closed';

create unique index if not exists reports_one_per_message
  on public.reports (reporter_id, message_id)
  where message_id is not null;

create or replace function public.check_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_hour int;
  recent_day  int;
begin
  select count(*) into recent_hour
  from reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '1 hour';

  if recent_hour >= 5 then
    raise exception 'Too many reports in a short time. Please try again later.'
      using errcode = 'check_violation';
  end if;

  select count(*) into recent_day
  from reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '24 hours';

  if recent_day >= 15 then
    raise exception 'Daily report limit reached. Please try again tomorrow.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_report_rate_limit on public.reports;
create trigger trg_check_report_rate_limit
  before insert on public.reports
  for each row
  execute function public.check_report_rate_limit();

-- ── e) telling the admins ────────────────────────────────────────────────
-- NOT email. Email needs an provider account, an API key stored somewhere the
-- database can reach it, and either the pg_net extension (not enabled on this
-- project — the same pre-flight that has held up recurring games) or a new
-- Edge Function to deploy and maintain. That is a new external dependency and
-- a new secret for one notification.
--
-- This uses the notifications table that already exists and already has a bell
-- in the nav, so a new report shows up in-app with no new infrastructure.
-- SECURITY DEFINER for the same reason notify_game_full is: notifications has
-- no INSERT policy, so only a definer function can write a row addressed to
-- somebody else.
create or replace function public.notify_admins_of_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, game_id, type, message)
  select p.id, null, 'report_filed',
         'A new report is waiting in the moderation queue.'
  from profiles p
  where p.is_admin
    and p.id <> new.reporter_id;  -- an admin reporting doesn't ping themselves

  return new;
end;
$$;

drop trigger if exists trg_notify_admins_of_report on public.reports;
create trigger trg_notify_admins_of_report
  after insert on public.reports
  for each row
  execute function public.notify_admins_of_report();

-- ── f) a deleted account takes its reports with it ───────────────────────
-- A trigger on profiles rather than another revision of delete_my_account():
-- it is self-contained here, and it covers every path that removes a profile
-- rather than only that one function.
--
-- Both directions go. Reports the person filed are their own data. Reports
-- ABOUT them are moot — the account they concern no longer exists, which is
-- the strongest outcome moderation could have reached anyway.
create or replace function public.clear_reports_for_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from reports
  where reporter_id = old.id or reported_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_clear_reports_for_deleted_profile on public.profiles;
create trigger trg_clear_reports_for_deleted_profile
  after delete on public.profiles
  for each row
  execute function public.clear_reports_for_deleted_profile();

-- ── g) notes ─────────────────────────────────────────────────────────────
-- THE ADMIN GATE IS THIS RLS, not the /admin/reports route. That page checks
-- profiles.is_admin only to decide what to render; somebody who reaches the
-- URL without the flag gets an empty list, because the SELECT policy returns
-- them nothing. The route is convenience, the policy is the boundary.
--
-- DEPENDS ON: nothing pending. Independent of the blocks and account-deletion
-- migrations, though it reads best after them.
