-- supabase/migrations/20260911000000_attendance_and_reliability.sql
-- ATTENDANCE: record who actually turned up, inside the existing consensus
-- scoresheet flow. No separate confirm step, no new screen.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- THE PROBLEM THIS HAS TO SOLVE FIRST
-- submit_result_entry finalises a result only when every participant has filed
-- a scoresheet (v_submitted >= v_total). A player who did not turn up does not
-- file one. So today the exact situation attendance exists to record — a
-- no-show — is the situation that leaves the result stuck at 'pending' for
-- ever: never confirmed, never counted for ratings, never counted for
-- anything. Attendance cannot be recorded without changing that rule.
--
-- THE RULE, and why it is unanimity
-- Each scoresheet now also carries who the submitter says was absent. Somebody
-- is recorded absent only when EVERY player who filed a scoresheet says so.
-- Two reasons: it matches how the scores themselves already work (any
-- disagreement means no result), and being marked a no-show is public and
-- moves a number on your profile — one teammate should not be able to do that
-- to another. The cost is accepted: if the players who turned up disagree
-- about who was missing, nothing is recorded and the result stays pending,
-- exactly as a disputed score does.
--
-- Absent players are then excluded from the count of who still owes a
-- scoresheet, which is what unjams finalisation: three players submit, all
-- three name the fourth, the result confirms with three attendances recorded
-- and one absence.

-- ── a) the column ────────────────────────────────────────────────────────
-- NULLABLE on purpose, and null means "we never asked". It is NOT the same as
-- false. Every result confirmed before this migration ran has no attendance
-- information, and defaulting those to `true` would invent a clean record for
-- people nobody ever checked on. Reliability counts only rows where attended
-- IS NOT NULL, so history is excluded rather than fabricated — which is also
-- why every player reads as "no data yet" until they play new games.
alter table public.match_result_participants
  add column if not exists attended boolean;

comment on column public.match_result_participants.attended is
  'Did they turn up? true/false recorded when the result confirmed. NULL = never recorded (all results predating attendance).';

-- ── b) who reported whom absent ──────────────────────────────────────────
-- One row per (result, reporter, person they say was missing). The RPC in
-- (c) reads it to work out who every submitter agrees was absent.
create table if not exists public.match_result_absences (
  result_id      bigint not null references public.match_results (id) on delete cascade,
  reported_by    uuid   not null,
  absent_user_id uuid   not null,
  primary key (result_id, reported_by, absent_user_id)
);

alter table public.match_result_absences enable row level security;

-- Same stance as match_result_entries: participants only. Who named whom is
-- visible to the four of them so a disagreement can be talked about, and to
-- nobody else.
drop policy if exists "Participants read this match's absences" on public.match_result_absences;
create policy "Participants read this match's absences"
  on public.match_result_absences for select
  to authenticated
  using (
    exists (
      select 1 from match_result_participants p
      where p.result_id = match_result_absences.result_id
        and p.user_id = auth.uid()
    )
  );

-- No direct write policies: the RPC owns every write, exactly as it does for
-- match_result_entries.

-- ── c) the scoresheet, now carrying absences ─────────────────────────────
-- Adding a parameter makes an OVERLOAD rather than a replacement, and two
-- functions of the same name leave PostgREST unable to choose. Drop the old
-- two-argument version explicitly first.
drop function if exists public.submit_result_entry(bigint, jsonb);

create or replace function public.submit_result_entry(
  p_game_id bigint,
  p_sets    jsonb,
  p_absent  uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_result_id  bigint;
  v_status     text;
  v_set_count  int;
  v_i          int;
  v_set        jsonb;
  v_t1         int;
  v_t2         int;
  v_t1_sets    int := 0;
  v_t2_sets    int := 0;
  v_total      int;
  v_submitted  int;
  v_variants   int;
  v_winner     int;
  v_absent     uuid[];
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  -- Lock the result row so simultaneous submissions queue instead of racing.
  select id, status into v_result_id, v_status
  from match_results where game_id = p_game_id
  for update;

  if v_result_id is null then
    raise exception 'No match has been started for game %', p_game_id;
  end if;
  if v_status = 'confirmed' then
    raise exception 'Result already finalised';
  end if;

  if not exists (
    select 1 from match_result_participants
    where result_id = v_result_id and user_id = v_uid
  ) then
    raise exception 'Caller is not a participant in this match';
  end if;

  -- Absences must name real participants, and you cannot mark yourself absent
  -- (you are filing a scoresheet, so you were evidently there).
  if exists (
    select 1 from unnest(coalesce(p_absent, '{}'::uuid[])) u
    where not exists (
      select 1 from match_result_participants
      where result_id = v_result_id and user_id = u
    )
  ) then
    raise exception 'Only players in this match can be marked absent';
  end if;
  if v_uid = any (coalesce(p_absent, '{}'::uuid[])) then
    raise exception 'You cannot mark yourself absent';
  end if;

  -- Validate the scoresheet — unchanged rules.
  if jsonb_typeof(p_sets) is distinct from 'array' then
    raise exception 'Sets must be a list';
  end if;
  v_set_count := jsonb_array_length(p_sets);
  if v_set_count < 1 or v_set_count > 3 then
    raise exception 'Enter between 1 and 3 sets';
  end if;

  for v_i in 0 .. v_set_count - 1 loop
    v_set := p_sets -> v_i;
    if jsonb_typeof(v_set -> 'team1_games') is distinct from 'number'
       or jsonb_typeof(v_set -> 'team2_games') is distinct from 'number' then
      raise exception 'Set % is missing a score', v_i + 1;
    end if;
    v_t1 := (v_set ->> 'team1_games')::int;
    v_t2 := (v_set ->> 'team2_games')::int;
    if v_t1 < 0 or v_t1 > 7 or v_t2 < 0 or v_t2 > 7 then
      raise exception 'Set % scores must be between 0 and 7', v_i + 1;
    end if;
    if v_t1 = v_t2 then
      raise exception 'Set % is tied — each set needs a winner', v_i + 1;
    end if;
    if v_t1 > v_t2 then v_t1_sets := v_t1_sets + 1;
    else                v_t2_sets := v_t2_sets + 1;
    end if;
  end loop;

  if v_t1_sets = v_t2_sets then
    raise exception 'These set scores have no overall winner';
  end if;

  -- Replace this caller's scoresheet (resubmits overwrite), absences included.
  delete from match_result_entries
  where result_id = v_result_id and user_id = v_uid;

  insert into match_result_entries
    (result_id, user_id, set_number, team1_games, team2_games)
  select v_result_id, v_uid, ord::smallint,
         (elem ->> 'team1_games')::smallint,
         (elem ->> 'team2_games')::smallint
  from jsonb_array_elements(p_sets) with ordinality as t(elem, ord);

  delete from match_result_absences
  where result_id = v_result_id and reported_by = v_uid;

  insert into match_result_absences (result_id, reported_by, absent_user_id)
  select v_result_id, v_uid, u
  from unnest(coalesce(p_absent, '{}'::uuid[])) u;

  -- ── who is agreed to be absent ──
  -- Unanimous among submitters: named by every player who filed a scoresheet.
  -- (An absent player files nothing, so they are not a submitter and do not
  -- get a vote on their own absence.)
  select count(distinct user_id) into v_submitted
  from match_result_entries where result_id = v_result_id;

  select coalesce(array_agg(absent_user_id), '{}'::uuid[])
  into v_absent
  from (
    select absent_user_id
    from match_result_absences
    where result_id = v_result_id
    group by absent_user_id
    having count(distinct reported_by) = v_submitted
  ) agreed;

  -- Everyone in? Absent players are excluded from who still owes a sheet —
  -- this is the change that lets a match with a no-show ever finalise.
  select count(*) into v_total
  from match_result_participants
  where result_id = v_result_id
    and not (user_id = any (v_absent));

  if v_submitted < v_total then
    return jsonb_build_object(
      'status', v_status, 'submitted', v_submitted, 'total', v_total
    );
  end if;

  -- All scoresheets in — compare them.
  select count(distinct sheet) into v_variants
  from (
    select jsonb_agg(
             jsonb_build_array(set_number, team1_games, team2_games)
             order by set_number
           ) as sheet
    from match_result_entries
    where result_id = v_result_id
    group by user_id
  ) s;

  if v_variants > 1 then
    update match_results set status = 'disputed' where id = v_result_id;
    return jsonb_build_object(
      'status', 'disputed', 'submitted', v_submitted, 'total', v_total
    );
  end if;

  -- Consensus. Write the canonical sets and finalise.
  delete from match_result_sets where result_id = v_result_id;
  insert into match_result_sets (result_id, set_number, team1_games, team2_games)
  select set_number, team1_games, team2_games
  from match_result_entries
  where result_id = v_result_id and user_id = v_uid;

  select case when sum(case when team1_games > team2_games then 1 else 0 end)
              > sum(case when team2_games > team1_games then 1 else 0 end)
         then 1 else 2 end
  into v_winner
  from match_result_sets where result_id = v_result_id;

  -- ATTENDANCE IS WRITTEN HERE, and only here: at the moment the result
  -- becomes real. A pending or disputed result records nothing, so a match
  -- that never finalises never marks anybody as a no-show.
  update match_result_participants
  set attended = not (user_id = any (v_absent))
  where result_id = v_result_id;

  update match_results
  set status = 'confirmed', winning_team = v_winner, confirmed_at = now()
  where id = v_result_id;

  return jsonb_build_object(
    'status', 'confirmed', 'submitted', v_submitted, 'total', v_total
  );
end;
$$;

grant execute on function public.submit_result_entry(bigint, jsonb, uuid[]) to authenticated;

-- ── d) notes ─────────────────────────────────────────────────────────────
-- The reliability score itself is NOT stored. It is a pure count over
-- match_result_participants rows where attended is not null — order
-- independent, so unlike the Elo rating it needs no replay, no one-shot flag
-- and no rebuild job. It is computed on read in getPlayerMatchStats, which
-- already fetches exactly these rows, so it costs no extra query. Same stance
-- as badges (src/app/badges.ts).
--
-- Games where no result was ever submitted are excluded automatically: there
-- is no match_results row, so the player is not a participant in anything and
-- appears in neither the numerator nor the denominator. Nobody is penalised
-- for a game that was simply never recorded.
