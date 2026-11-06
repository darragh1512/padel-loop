-- Save each player's rating change on the result that caused it.
--
-- The rating itself has always been stored, but not how much each game moved it,
-- so a profile couldn't show +14 or −9 beside a result. From now on each newly
-- confirmed result records it.
--
-- Nothing existing is edited: no rating moves, and results already confirmed keep
-- an empty change, so they show none. The file doesn't run rebuild_all_ratings().
--
-- Run order: after 20260812000000_ratings.sql. No pre-flight. Safe before or after
-- the app deploy: the app reads a missing column as no change. Re-running is safe.

-- ── a) stop if live isn't what this file expects ─────────────────────────
do $check$
declare
  v_body text;
begin
  select replace(p.prosrc, chr(13), '') into v_body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'apply_result_rating' and p.pronargs = 1;

  if v_body is null then
    raise exception 'STOPPED, nothing changed: apply_result_rating does not exist. Send this message to Claude.';
  end if;
  -- Already has it: a re-run of this file, which is fine.
  if position('rating_change' in v_body) = 0 and md5(v_body) <> 'a1709a1bfbe3376fc808d32edb302ce0' then
    raise exception 'STOPPED, nothing changed: the live apply_result_rating differs from the expected version. Send this message to Claude.';
  end if;
end;
$check$;

-- ── b) the change ────────────────────────────────────────────────────────
alter table public.match_result_participants add column if not exists rating_change integer;

-- ── c) record it when a result is confirmed ──────────────────────────────
-- Identical to the 20260812000000 version except for the three lines marked NEW
-- and the variable that holds the change. The sum and the rating are the same.
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
  v_change  int;
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

    v_change := round(v_k * (v_score - v_expect))::int;

    update profiles
    set rating = p.rating + v_change
    where id = p.user_id;

    -- NEW: remember what this result did, so a profile can show +14 or −9.
    update match_result_participants
    set rating_change = v_change
    where result_id = p_result_id and user_id = p.user_id;
  end loop;

  update match_results set rating_applied = true where id = p_result_id;
end;
$$;

revoke all on function public.apply_result_rating(bigint) from public, anon, authenticated;
