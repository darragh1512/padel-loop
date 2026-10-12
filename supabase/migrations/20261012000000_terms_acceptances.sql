-- supabase/migrations/20261012000000_terms_acceptances.sql
-- PROOF OF AGREEMENT: who ticked "I agree to the Terms of Use and Privacy
-- Policy" at sign-up, when, and which versions of the two documents they were
-- agreeing to. Kept as evidence for GDPR.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- WHY A TABLE AND NOT A COLUMN ON profiles
-- profiles has an "update your own row" policy, so a column there could be
-- rewritten by its owner through the API at any time — weak evidence. This
-- table is APPEND-ONLY for players: they can add their own row and read their
-- own rows, and there are no update or delete policies at all. It also keeps
-- history: when the terms change and people agree again, that is a new row,
-- not an overwritten date.
--
-- THE TIME IS THE SERVER'S. A trigger stamps accepted_at = now() on insert,
-- whatever the browser sent, so nobody can backdate an agreement.
--
-- ACCOUNT DELETION: rows go with the account (on delete cascade from
-- auth.users), consistent with delete_my_account() removing everything else.

-- ── a) the table ─────────────────────────────────────────────────────────
create table if not exists public.terms_acceptances (
  id               bigint generated always as identity primary key,
  user_id          uuid        not null default auth.uid()
                               references auth.users (id) on delete cascade,
  -- The "Last updated" date of each document as shown to them, e.g.
  -- '2026-09-09'. Comes from src/app/terms-acceptance.ts.
  terms_version    text        not null,
  privacy_version  text        not null,
  accepted_at      timestamptz not null default now()
);

create index if not exists terms_acceptances_user_id_idx
  on public.terms_acceptances (user_id);

comment on table public.terms_acceptances is
  'Append-only record of each player agreeing to the Terms of Use and Privacy Policy (GDPR evidence). accepted_at is server-stamped.';

-- ── b) server-stamped time ───────────────────────────────────────────────
create or replace function public.stamp_terms_acceptance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.accepted_at := now();
  return new;
end;
$$;

drop trigger if exists trg_stamp_terms_acceptance on public.terms_acceptances;
create trigger trg_stamp_terms_acceptance
  before insert on public.terms_acceptances
  for each row
  execute function public.stamp_terms_acceptance();

-- ── c) who may do what ───────────────────────────────────────────────────
-- Add your own row; read your own rows (admins can read all, to answer a
-- GDPR request or a dispute). Deliberately NO update and NO delete policy.
alter table public.terms_acceptances enable row level security;

drop policy if exists "Players record their own acceptance"
  on public.terms_acceptances;
create policy "Players record their own acceptance"
  on public.terms_acceptances for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Players read own acceptances, admins read all"
  on public.terms_acceptances;
create policy "Players read own acceptances, admins read all"
  on public.terms_acceptances for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ── d) notes ─────────────────────────────────────────────────────────────
-- No backfill on purpose. Players who signed up before this existed never
-- ticked a box, and inventing a row for them would be false evidence.
--
-- To look someone up (SQL editor):
--   select u.email, t.terms_version, t.privacy_version, t.accepted_at
--   from terms_acceptances t join auth.users u on u.id = t.user_id
--   order by t.accepted_at desc;
