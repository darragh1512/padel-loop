-- supabase/migrations/20260809000001_consensus_entries_resume.sql
-- RESUME of 20260809000000_consensus_entries.sql, which only partially
-- applied: its section 1 (the two ALTER TABLE check constraints on
-- match_result_participants.team and match_results.status) DID run; nothing
-- after it did. This file is everything from section 2 onward, made fully
-- idempotent — safe to run any number of times. RUN in SQL editor, then save
-- in repo. The original file should NOT be run again (its unguarded
-- constraints would error); it stays in the repo as the design record.

-- 2. Per-participant scoresheets ----------------------------------------------
-- One row per (player, set): what THAT player says the set score was. The
-- canonical match_result_sets rows are only written once these all agree.
create table if not exists public.match_result_entries (
  result_id   bigint   not null,
  user_id     uuid     not null,
  set_number  smallint not null check (set_number between 1 and 3),
  team1_games smallint not null check (team1_games between 0 and 7),
  team2_games smallint not null check (team2_games between 0 and 7),
  created_at  timestamptz not null default now(),
  primary key (result_id, user_id, set_number),
  foreign key (result_id, user_id)
    references public.match_result_participants (result_id, user_id)
    on delete cascade
);

alter table public.match_result_entries enable row level security;

-- Scoresheets are PRIVATE to the match: only its participants can read them
-- (they need each other's entries for the dispute view). The result row,
-- teams, and canonical sets stay readable by any signed-in user (unchanged
-- baseline policies) — profile stats and the game page depend on that.
-- (drop-then-create because CREATE POLICY has no IF NOT EXISTS.)
drop policy if exists "Participants read their match's entries"
  on public.match_result_entries;
create policy "Participants read their match's entries"
  on public.match_result_entries for select to authenticated
  using (
    exists (select 1 from public.match_result_participants mrp
            where mrp.result_id = match_result_entries.result_id
              and mrp.user_id = auth.uid())
  );
-- No insert/update/delete policies: the security-definer RPCs below own every
-- write, so nobody can edit a scoresheet except through the validated path.

-- 3. Owner starts the match ---------------------------------------------------
create or replace function public.start_match_result(
  p_game_id bigint,
  p_team1   uuid[],
  p_team2   uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_created_by uuid;
  v_max        int;
  v_count      int;
  v_result_id  bigint;
  v_all        uuid[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select created_by, max_players into v_created_by, v_max
  from games where id = p_game_id;
  if not found then
    raise exception 'Game % not found', p_game_id;
  end if;
  if v_created_by is distinct from v_uid then
    raise exception 'Only the game owner can start the match';
  end if;

  -- A true 2v2: two per side, four distinct players.
  if coalesce(array_length(p_team1, 1), 0) <> 2
     or coalesce(array_length(p_team2, 1), 0) <> 2 then
    raise exception 'Each team needs exactly 2 players';
  end if;
  v_all := p_team1 || p_team2;
  if (select count(distinct u) from unnest(v_all) u) <> 4 then
    raise exception 'Each player can only be on one team';
  end if;

  -- The game must be full, and the four named players must be its roster.
  select count(*) into v_count from game_players where game_id = p_game_id;
  if v_count <> v_max then
    raise exception 'The game is not full yet (% of % spots taken)', v_count, v_max;
  end if;
  if v_count <> 4 then
    raise exception 'Match results need a 4-player game';
  end if;
  if exists (
    select 1 from unnest(v_all) u
    where not exists (select 1 from game_players gp
                      where gp.game_id = p_game_id and gp.user_id = u)
  ) then
    raise exception 'Teams must be made up of the players in this game';
  end if;

  -- One result per game — a second start trips the UNIQUE on game_id (23505).
  insert into match_results (game_id, submitted_by, status)
  values (p_game_id, v_uid, 'pending')
  returning id into v_result_id;

  insert into match_result_participants (result_id, user_id, team, confirmation)
  select v_result_id, u, 1, 'pending' from unnest(p_team1) u
  union all
  select v_result_id, u, 2, 'pending' from unnest(p_team2) u;

  return jsonb_build_object('result_id', v_result_id, 'status', 'pending');
end;
$$;

grant execute on function public.start_match_result(bigint, uuid[], uuid[]) to authenticated;

-- 4. A participant submits (or resubmits) their scoresheet --------------------
-- p_sets is a json array of {team1_games, team2_games}, in playing order.
create or replace function public.submit_result_entry(
  p_game_id bigint,
  p_sets    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_result_id bigint;
  v_status    text;
  v_set_count int;
  v_t1        int;
  v_t2        int;
  v_t1_sets   int := 0;
  v_t2_sets   int := 0;
  v_i         int;
  v_set       jsonb;
  v_total     int;
  v_submitted int;
  v_variants  int;
  v_winner    smallint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the result row so simultaneous submissions queue instead of racing
  -- (same protection the old confirm RPC had): the last-to-run sees every
  -- committed scoresheet and the compare below is authoritative.
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

  -- Validate the scoresheet — the same rules the entry form enforces:
  -- 1–3 sets, whole scores 0–7, no tied set, and a strict overall winner.
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

  -- Replace this caller's scoresheet (resubmits overwrite).
  delete from match_result_entries
  where result_id = v_result_id and user_id = v_uid;

  insert into match_result_entries
    (result_id, user_id, set_number, team1_games, team2_games)
  select v_result_id, v_uid, ord::smallint,
         (elem ->> 'team1_games')::smallint,
         (elem ->> 'team2_games')::smallint
  from jsonb_array_elements(p_sets) with ordinality as t(elem, ord);

  -- Everyone in?
  select count(*) into v_total
  from match_result_participants where result_id = v_result_id;
  select count(distinct user_id) into v_submitted
  from match_result_entries where result_id = v_result_id;

  if v_submitted < v_total then
    return jsonb_build_object(
      'status', v_status, 'submitted', v_submitted, 'total', v_total
    );
  end if;

  -- All scoresheets in — compare them. Each player's entries collapse to one
  -- ordered value; more than one distinct value means somebody disagrees.
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

  -- Consensus — this caller's scoresheet IS the agreed score. Write it as the
  -- canonical sets and finalise.
  delete from match_result_sets where result_id = v_result_id;
  insert into match_result_sets (result_id, set_number, team1_games, team2_games)
  select result_id, set_number, team1_games, team2_games
  from match_result_entries
  where result_id = v_result_id and user_id = v_uid;

  -- v_t1_sets/v_t2_sets already hold this scoresheet's set wins, and a tie was
  -- rejected above, so the winner is unambiguous.
  if v_t1_sets > v_t2_sets then v_winner := 1; else v_winner := 2; end if;

  update match_results
  set status = 'confirmed', winning_team = v_winner, confirmed_at = now()
  where id = v_result_id;

  return jsonb_build_object(
    'status', 'confirmed', 'submitted', v_submitted, 'total', v_total,
    'winning_team', v_winner
  );
end;
$$;

grant execute on function public.submit_result_entry(bigint, jsonb) to authenticated;

-- 5. Retire the old flow ------------------------------------------------------
-- The confirm RPC and the submitter-writes-directly policies are superseded:
-- every write now goes through the two RPCs above. All idempotent (IF EXISTS).
drop function if exists public.confirm_match_result(bigint);

drop policy if exists "Game members can submit a result"    on public.match_results;
drop policy if exists "Submitter creates participant rows"  on public.match_result_participants;
drop policy if exists "Submitter writes sets"               on public.match_result_sets;
drop policy if exists "Submitter updates sets"              on public.match_result_sets;
drop policy if exists "Submitter deletes sets"              on public.match_result_sets;
-- The "readable by authenticated" SELECT policies stay — the game page and
-- profile stats read results/teams/sets for matches the viewer isn't in.

-- 6. Realtime -----------------------------------------------------------------
-- Let the game page hear results start/flip and scoresheets land, the same way
-- chat hears new messages. Guarded so re-running never errors.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'match_results') then
    alter publication supabase_realtime add table public.match_results;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'match_result_entries') then
    alter publication supabase_realtime add table public.match_result_entries;
  end if;
end $$;
