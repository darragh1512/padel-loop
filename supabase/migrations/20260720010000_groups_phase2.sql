-- supabase/migrations/20260720010000_groups_phase2.sql
-- Phase 2 of group chats: propose a private game inside a group, notify
-- members, join from the thread. RUN in SQL editor, then save in repo.
--
-- Reviewed and approved 2026-07-20 (continuing the same day as phase 1).
-- game_players' INSERT policy (with_check (user_id = auth.uid())) has no
-- game-level condition at all, so a group member already satisfies it for a
-- group game today — NOT touched by this migration, no change needed.
-- games' SELECT policy is NOT touched either. Group-game "privacy" is
-- "not surfaced on Discover, not publicly linked" (application-level query
-- filtering in lib/data.ts), matching the explicit non-RLS design decision
-- from the phase-2 kickoff, not a read restriction.

-- a) games: a group game is a normal game with a group_id. Existing games
-- keep it null and are completely unaffected.
alter table public.games
  add column if not exists group_id bigint references public.groups (id) on delete cascade;

-- b) Multi-recipient notification fan-out, same idiom as notify_game_full
-- (SECURITY DEFINER — the notifications table has no INSERT policy, so this
-- bypass is the only way a row gets created, exactly like the existing
-- trigger). A SEPARATE trigger for a separate event; notify_game_full is
-- untouched. search_path is pinned to public, pg_temp (hardened vs.
-- notify_game_full's own header, which only pins `public` — logged as a
-- follow-up to reconcile later, not fixed here).
create or replace function public.notify_group_game_proposed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_name text;
begin
  -- Only fires for group games with a real proposer; anything else is
  -- outside this trigger's concern (mirrors notify_game_full's own
  -- early-return style for irrelevant rows).
  if NEW.group_id is null or NEW.created_by is null then
    return NEW;
  end if;

  select name into v_group_name from groups where id = NEW.group_id;

  -- One notification per OTHER group member (never the proposer), same
  -- (user_id, game_id, type, message) shape notify_game_full already writes.
  insert into notifications (user_id, game_id, type, message)
  select
    gm.user_id,
    NEW.id,
    'group_game_proposed',
    'New game proposed in "' || coalesce(v_group_name, 'your group') || '": ' ||
      coalesce(NEW.venue, 'a game') || '.'
  from group_members gm
  where gm.group_id = NEW.group_id
    and gm.user_id <> NEW.created_by;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_group_game_proposed on games;

create trigger trg_notify_group_game_proposed
  after insert on games
  for each row
  execute function notify_group_game_proposed();
