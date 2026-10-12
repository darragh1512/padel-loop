-- supabase/migrations/20261012010000_delete_account_storage_api.sql
-- FIX ACCOUNT DELETION: stop deleting avatar files directly from
-- storage.objects, which Supabase now refuses:
--
--   ERROR: 42501: Direct deletion from storage tables is not allowed.
--   Use the Storage API instead.
--
-- That one statement made delete_my_account() fail — and, because it is one
-- transaction, roll back entirely — for every account, photo or not.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- THE NEW SPLIT
--   • The APP deletes the player's photo files through the Storage API, while
--     they are still signed in (deleteMyAccount in src/app/profiles.ts). It
--     has to go first: once the account is gone, nobody holds the permission
--     to delete those files.
--   • This function no longer deletes files. Instead, just before removing
--     the account, it LOOKS for any of their files still in the avatars
--     bucket and writes each one to avatar_cleanup. Reading storage.objects
--     is still allowed; only deleting from it is blocked.
--   • The account is deleted either way. A leftover photo never blocks a
--     deletion (GDPR: the person asked to go), and it is never silently
--     forgotten (GDPR: the photo must still be erased) — it is on the list.
--
-- WHY THE DATABASE CHECKS RATHER THAN TRUSTING THE APP: the Storage API's
-- remove() reports success with nothing removed when a policy says no, so
-- the app cannot reliably know a file survived. The bucket itself can.

-- ── a) the clean-up list ─────────────────────────────────────────────────
-- No foreign key on user_id: the account it names is deleted in the same
-- transaction that writes the row. RLS on with no policies: nobody reaches
-- this through the app; the owner reads and clears it in the dashboard.
create table if not exists public.avatar_cleanup (
  id           bigint generated always as identity primary key,
  user_id      uuid        not null,
  object_name  text        not null unique,
  logged_at    timestamptz not null default now()
);

alter table public.avatar_cleanup enable row level security;

comment on table public.avatar_cleanup is
  'Photo files left in the avatars bucket after their account was deleted. Delete each file in Storage, then delete its row here.';

-- ── b) delete_my_account(), without the direct storage delete ────────────
-- Supersedes the version in 20260914000000_blocks.sql. Identical except the
-- storage.objects DELETE is replaced by the avatar_cleanup INSERT.
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
  delete from blocks where blocker_id = v_uid or blocked_id = v_uid;

  -- CHANGED: the app has already deleted their photo files through the
  -- Storage API. Anything still here survived that — record it for clean-up
  -- and carry on. Never deletes from storage.objects (Supabase forbids it).
  insert into avatar_cleanup (user_id, object_name)
  select v_uid, o.name
  from storage.objects o
  where o.bucket_id = 'avatars'
    and (o.name = v_uid::text || '/avatar' or o.name like v_uid::text || '/%')
  on conflict (object_name) do nothing;

  delete from profiles where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ── c) notes ─────────────────────────────────────────────────────────────
-- CLEARING THE LIST (owner, in the dashboard):
--   1. select * from avatar_cleanup order by logged_at;
--   2. Storage → avatars → open the folder named by user_id → delete the file.
--   3. delete from avatar_cleanup where id = <id>;
--
-- DEPENDS ON: 20260914000000_blocks.sql (whose function this supersedes).
