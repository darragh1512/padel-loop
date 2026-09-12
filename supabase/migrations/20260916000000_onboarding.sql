-- supabase/migrations/20260916000000_onboarding.sql
-- FIRST RUN: remember that we have asked somebody to set themselves up, so we
-- never ask twice.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- WHY A COLUMN AND NOT localStorage
-- The requirement is that the flow cannot re-trigger on every login. A flag in
-- the browser fails that on a second device, a different browser, a private
-- window, or any cleared site data — and it fails silently, by showing the
-- setup screen again to somebody who has been using the app for a month. The
-- fact belongs to the account, so it lives with the account.
--
-- NULL means never asked. A timestamp means asked, whether they filled it in
-- or skipped it: skipping has to close the question, or "skippable" and
-- "cannot re-trigger" contradict each other. So this records that we ASKED,
-- not that we got anything — profiles.skill_level and home_club are where you
-- look to find out whether they actually told us.
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'When first-run setup was completed OR skipped. NULL = never shown. Records that we asked, not that they answered.';

-- No RLS change needed: this is another column on profiles, which already has
-- its policies, and Postgres RLS is row-level — the existing "update your own
-- row" rule covers it.
--
-- No backfill on purpose. Every existing player gets the setup screen once on
-- their next visit to the home screen, which is the correct outcome: nobody
-- has a home club recorded yet, and that is exactly what this collects.
-- If you would rather leave existing players alone, run this once after:
--
--   update profiles set onboarded_at = now() where onboarded_at is null;
