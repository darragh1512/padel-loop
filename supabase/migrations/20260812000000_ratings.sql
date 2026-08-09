-- supabase/migrations/20260812000000_ratings.sql
-- PLAYER RATINGS: an Elo-style rating per player, moved only by CONFIRMED
-- match results (never pending/disputed). RUN in SQL editor, then save in
-- repo. Every statement here is idempotent — a partial run can be retried
-- from the top safely, and the final rebuild is a full recompute.
--
-- How it works:
--   • profiles.rating starts from the player's SELF-DECLARED skill level
--     (Beginner 800, Improver 900, Intermediate 1000, Advanced 1100,
--     Pro 1200) so new players aren't all identical.
--   • When a result flips to 'confirmed', each of the four players moves by
--     K * (score - expected), K = 32, where expected comes from the classic
--     Elo curve against the AVERAGE rating of the OPPOSING pair — the
--     standard doubles adaptation.
--   • match_results.rating_applied is the one-shot flag (same idiom as
--     games.creator_notified): a result can only ever move ratings once.
--   • rebuild_all_ratings() resets every profile to its skill base and
--     replays all confirmed results in confirmed_at order — used for the
--     retroactive backfill at the bottom, and safe to re-run any time.
--
-- Known limitation (accepted for now): the profiles UPDATE policy lets a
-- player update their own row, and Postgres RLS is row- not column-level,
-- so a determined user could hand-edit their own rating via the API. The
-- same trust level already applies elsewhere (e.g. game_players has no
-- capacity check). rebuild_all_ratings() corrects any tampering.

-- ── a) columns ───────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists rating integer;

alter table public.match_results
  add column if not exists rating_applied boolean not null default false;

-- ── b) the skill → starting rating map ───────────────────────────────────
create or replace function public.skill_base_rating(p_skill text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_skill), ''))
    when 'beginner'     then  800
    when 'improver'     then  900
    when 'intermediate' then 1000
    when 'advanced'     then 1100
    when 'pro'          then 1200
    else 1000  -- unknown/unset skill reads as the middle of the scale
  end;
$$;

-- New profiles (and older rows saved without one) pick up their base rating
-- automatically. Only fills a NULL — it never overwrites a rating that
-- matches have moved.
create or replace function public.default_profile_rating()
returns trigger
language plpgsql
as $$
begin
  if NEW.rating is null then
    NEW.rating := public.skill_base_rating(NEW.skill_level);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_default_profile_rating on public.profiles;
create trigger trg_default_profile_rating
  before insert or update on public.profiles
  for each row
  execute function public.default_profile_rating();

-- ── c) apply one confirmed result ────────────────────────────────────────
-- SECURITY DEFINER like every privileged write in this repo. Reads the four
-- participants, moves each player's rating against the opposing pair's
-- average, and flips rating_applied so the same result can never be applied
-- twice.
create or replace function public.apply_result_rating(p_result_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_applied boolean;
  v_winner  smallint;
  v_avg1    numeric;  -- average rating of team 1, before this result
  v_avg2    numeric;  -- average rating of team 2, before this result
  p         record;
  v_opp_avg numeric;
  v_score   numeric;
  v_expect  numeric;
  v_k       constant numeric := 32;
begin
  select rating_applied, winning_team into v_applied, v_winner
  from match_results
  where id = p_result_id and status = 'confirmed'
  for update;

  if not found or v_applied or v_winner is null then
    return;  -- not confirmed, already applied, or nothing to score
  end if;

  -- Both teams' average ratings BEFORE any of this result's changes, so the
  -- four updates below all use the same pre-match numbers.
  select avg(coalesce(pr.rating, public.skill_base_rating(pr.skill_level)))
    into v_avg1
  from match_result_participants mrp
  join profiles pr on pr.id = mrp.user_id
  where mrp.result_id = p_result_id and mrp.team = 1;

  select avg(coalesce(pr.rating, public.skill_base_rating(pr.skill_level)))
    into v_avg2
  from match_result_participants mrp
  join profiles pr on pr.id = mrp.user_id
  where mrp.result_id = p_result_id and mrp.team = 2;

  if v_avg1 is null or v_avg2 is null then
    return;  -- participants without profiles; nothing sensible to score
  end if;

  for p in
    select mrp.user_id, mrp.team,
           coalesce(pr.rating, public.skill_base_rating(pr.skill_level)) as rating
    from match_result_participants mrp
    join profiles pr on pr.id = mrp.user_id
    where mrp.result_id = p_result_id
  loop
    v_opp_avg := case when p.team = 1 then v_avg2 else v_avg1 end;
    v_score   := case when p.team = v_winner then 1 else 0 end;
    v_expect  := 1 / (1 + power(10, (v_opp_avg - p.rating) / 400.0));

    update profiles
    set rating = p.rating + round(v_k * (v_score - v_expect))::int
    where id = p.user_id;
  end loop;

  update match_results set rating_applied = true where id = p_result_id;
end;
$$;

-- Internal only: triggers and rebuild call it as definer; clients never do.
revoke all on function public.apply_result_rating(bigint) from public, anon, authenticated;

-- ── d) fire on confirmation ──────────────────────────────────────────────
-- The WHEN clause only matches the pending/disputed → confirmed transition,
-- so the rating_applied update inside apply_result_rating (status stays
-- 'confirmed') can never re-fire it.
create or replace function public.rate_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.apply_result_rating(NEW.id);
  return NEW;
end;
$$;

drop trigger if exists trg_rate_on_confirm on public.match_results;
create trigger trg_rate_on_confirm
  after update on public.match_results
  for each row
  when (NEW.status = 'confirmed' and OLD.status is distinct from 'confirmed')
  execute function public.rate_on_confirm();

-- ── e) full rebuild (retroactive backfill; safe to re-run any time) ──────
create or replace function public.rebuild_all_ratings()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r        record;
  v_count  int := 0;
begin
  update profiles set rating = public.skill_base_rating(skill_level);
  update match_results set rating_applied = false where status = 'confirmed';

  for r in
    select id from match_results
    where status = 'confirmed'
    order by confirmed_at asc nulls last, id asc
  loop
    perform public.apply_result_rating(r.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.rebuild_all_ratings() from public, anon, authenticated;

-- ── f) retroactive award on existing data ────────────────────────────────
-- A full recompute, so running this file again is always safe.
select public.rebuild_all_ratings();
