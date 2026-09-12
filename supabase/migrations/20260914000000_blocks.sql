-- supabase/migrations/20260914000000_blocks.sql
-- BLOCKING: one-directional, and invisible to the person blocked.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- ONE-DIRECTIONAL means a row here is an assertion by the blocker about what
-- THEY see. It says nothing about what the blocked person sees, and blocking
-- somebody does not block you back. B can still see A, message in a shared
-- thread, and join a game A is in — they simply never learn that A stopped
-- seeing them.
--
-- INVISIBLE is enforced by the RLS below, not by the app being careful: the
-- SELECT policy is `blocker = auth.uid()`, so a blocked person cannot read a
-- row naming them even by calling the API directly. There is no query they can
-- write that returns "who has blocked me". That is the whole security model,
-- and it is why blocked_id is not exposed through any view or function.

-- ── a) the table ─────────────────────────────────────────────────────────
-- No FK to auth.users, matching the convention used by match_results
-- .submitted_by and groups.created_by — a deleted account must not cascade
-- other people's rows away. delete_my_account() clears these explicitly.
create table if not exists public.blocks (
  blocker_id uuid        not null,
  blocked_id uuid        not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

-- "Everyone I have blocked" — the only read pattern, and the one the filters
-- run on every screen.
create index if not exists blocks_blocker_idx
  on public.blocks (blocker_id);

-- ── b) RLS: you see only your own blocks ─────────────────────────────────
alter table public.blocks enable row level security;

-- Deliberately NOT `blocker_id = auth.uid() or blocked_id = auth.uid()`. The
-- second half would let somebody enumerate who has blocked them, which is
-- exactly the thing this feature promises not to reveal.
drop policy if exists "See only your own blocks" on public.blocks;
create policy "See only your own blocks"
  on public.blocks for select
  to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "Block as yourself" on public.blocks;
create policy "Block as yourself"
  on public.blocks for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "Unblock your own block" on public.blocks;
create policy "Unblock your own block"
  on public.blocks for delete
  to authenticated
  using (blocker_id = auth.uid());

-- No UPDATE policy: a block is created or removed, never edited.

-- ── c) blocking drops any connection between the two ─────────────────────
-- Done in the database rather than as a second client call, so a block can
-- never land while the two of them stay connected.
--
-- SECURITY DEFINER because the connections row may name the OTHER person as
-- requester, and the caller's own RLS would not let them delete it. The
-- WHERE clause is pinned to the two ids from the block row, so this cannot
-- reach any connection the blocker is not part of.
create or replace function public.drop_connection_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from connections
  where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
     or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists trg_drop_connection_on_block on public.blocks;
create trigger trg_drop_connection_on_block
  after insert on public.blocks
  for each row
  execute function public.drop_connection_on_block();

-- ── d) account deletion clears blocks in both directions ─────────────────
-- Supersedes the version in 20260913000000_delete_account.sql. A deleted
-- account must not leave rows naming it — including rows OTHER people own,
-- which is why this is inside the SECURITY DEFINER function rather than left
-- to the departing user's own permissions.
--
-- Only the two new statements differ; everything else is unchanged from that
-- file, re-issued so the two can be run in either order and end up the same.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_nullable   boolean;
  g            record;
  v_successor  uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  perform set_config('app.deleting_account', 'on', true);

  for g in
    select id, game_time, status
    from games
    where created_by = v_uid
  loop
    v_successor := null;

    if g.game_time > now()
       and coalesce(lower(btrim(g.status)), 'active') <> 'cancelled' then
      select gp.user_id into v_successor
      from game_players gp
      where gp.game_id = g.id and gp.user_id <> v_uid
      order by gp.ctid
      limit 1;
    end if;

    if v_successor is not null then
      update games set created_by = v_successor where id = g.id;

      insert into notifications (user_id, game_id, type, message)
      values (
        v_successor,
        g.id,
        'game_handed_over',
        'You are now the organiser of a game — the person who set it up has left Padel Loop.'
      );
    elsif g.game_time > now()
          and coalesce(lower(btrim(g.status)), 'active') <> 'cancelled' then
      update games set status = 'cancelled' where id = g.id;
    end if;
  end loop;

  select is_nullable = 'YES' into v_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'games'
    and column_name = 'created_by';

  if coalesce(v_nullable, false) then
    update games set created_by = null where created_by = v_uid;
  end if;

  for g in select id from groups where created_by = v_uid loop
    select gm.user_id into v_successor
    from group_members gm
    where gm.group_id = g.id and gm.user_id <> v_uid
    order by gm.joined_at
    limit 1;

    if v_successor is not null then
      update groups set created_by = v_successor where id = g.id;
    else
      delete from groups where id = g.id;
    end if;
  end loop;

  delete from game_waitlist where user_id = v_uid;
  delete from game_players  where user_id = v_uid;
  delete from group_members where user_id = v_uid or added_by = v_uid;
  delete from messages      where user_id = v_uid;
  delete from connections   where requester_id = v_uid or addressee_id = v_uid;
  delete from notifications where user_id = v_uid;

  -- NEW: blocks in BOTH directions. Rows where they are the blocked party
  -- belong to somebody else, but must still go — a block naming a deleted
  -- account is a dangling reference that would silently filter nothing.
  delete from blocks where blocker_id = v_uid or blocked_id = v_uid;

  delete from storage.objects
  where bucket_id = 'avatars'
    and (name = v_uid::text || '/avatar' or name like v_uid::text || '/%');

  delete from profiles where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ── e) notes ─────────────────────────────────────────────────────────────
-- WHAT BLOCKING DOES NOT DO, on purpose:
--
--   • It does not remove either person from a game. Padel is four people on
--     one court; an app that hides somebody who will physically be there
--     manufactures the confrontation it was meant to prevent. Rosters stay
--     truthful — the blocked player is shown to the blocker muted and
--     unclickable, never hidden — and the blocker is warned at each moment
--     they can still act on it.
--   • It does not restrict the blocked person's app in any way. They can join
--     any game, see any profile, post in any thread. Anything else would be
--     detectable, and a block they can detect is not invisible.
--   • It is not symmetric. B blocking A would be B's own separate row.
--
-- DEPENDS ON: 20260913000000_delete_account.sql (whose function is superseded
-- here). Run it after that one.
