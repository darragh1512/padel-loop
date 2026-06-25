-- supabase/migrations/20260625020000_confirm_result_lock.sql
-- Fixes the simultaneous-confirm race: serialises confirmations per result by
-- locking the match_results row up front. RUN in SQL editor, then save in repo.

create or replace function public.confirm_match_result(p_game_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_result_id bigint;
  v_status    text;
  v_is_part   boolean;
  v_remaining int;
  v_set_count int;
  v_t1_sets   int;
  v_t2_sets   int;
  v_winner    smallint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- CHANGED: for update — locks this result's row so concurrent confirms
  -- queue instead of racing. The second caller sees the first's committed
  -- confirmation and finalises correctly. Everything below is unchanged.
  select id, status into v_result_id, v_status
  from match_results where game_id = p_game_id
  for update;

  if v_result_id is null then
    raise exception 'No result exists for game %', p_game_id;
  end if;

  if v_status = 'confirmed' then
    raise exception 'Result already finalised';
  end if;

  select exists(
    select 1 from match_result_participants
    where result_id = v_result_id and user_id = v_uid
  ) into v_is_part;

  if not v_is_part then
    raise exception 'Caller is not a participant in this result';
  end if;

  update match_result_participants
  set confirmation = 'confirmed'
  where result_id = v_result_id and user_id = v_uid;

  select count(*) filter (where confirmation <> 'confirmed')
  into v_remaining
  from match_result_participants where result_id = v_result_id;

  if v_remaining > 0 then
    return jsonb_build_object(
      'status', 'pending',
      'confirmations_remaining', v_remaining,
      'winning_team', null
    );
  end if;

  select count(*),
         count(*) filter (where team1_games > team2_games),
         count(*) filter (where team2_games > team1_games)
  into v_set_count, v_t1_sets, v_t2_sets
  from match_result_sets where result_id = v_result_id;

  if v_set_count = 0 then
    raise exception 'Cannot finalise: no sets recorded';
  end if;

  if    v_t1_sets > v_t2_sets then v_winner := 1;
  elsif v_t2_sets > v_t1_sets then v_winner := 2;
  else  raise exception 'Cannot finalise: set scores do not yield a clear winner';
  end if;

  update match_results
  set status = 'confirmed', winning_team = v_winner, confirmed_at = now()
  where id = v_result_id;

  return jsonb_build_object(
    'status', 'confirmed',
    'confirmations_remaining', 0,
    'winning_team', v_winner
  );
end;
$$;
