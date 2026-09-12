-- supabase/migrations/20260913000000_delete_account.sql
-- DELETE MY ACCOUNT: one function, one transaction, called by the person
-- themselves. Either everything below happens or none of it does — there is no
-- state where the profile is gone but the auth user survives, or the reverse.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- THE PRINCIPLE: anonymise, then delete the identity.
--
-- Shared records are not the departing user's to erase. A confirmed match is
-- three other people's Played, Won, rating and badges; a game other people
-- joined is their Saturday. Those rows STAY, and they stop naming anybody the
-- moment the profiles row goes — the app already renders an unresolvable id as
-- "Player" (getPlayersForGame in src/lib/data.ts defaults the name), so
-- deleting the profile IS the anonymisation. Nothing has to overwrite the
-- uuids, and nothing should: they are what keeps teams, scores and rosters
-- internally consistent.
--
-- This works because of a deliberate schema decision that predates it: shared
-- tables carry a uuid with NO foreign key to auth.users
-- (match_results.submitted_by is annotated "no FK in live DB; references
-- auth.users.id by convention only", and groups.created_by matches it). So
-- deleting the auth user cannot cascade through anybody's history. The two
-- tables that DO cascade — notifications and game_waitlist — hold only the
-- user's own ephemera, which is correct.
--
-- Belt and braces regardless: every table is cleaned or reassigned BEFORE the
-- auth user is deleted, so no row still points at them when the delete lands.
-- Any cascade we cannot see from this repo therefore finds nothing to cascade.

-- ── a) let account deletion through the leave guard ──────────────────────
-- check_player_may_leave refuses to delete a game_players row when a match
-- result exists, or when the player is the game's creator. Both rules are
-- right for somebody leaving one game and wrong for somebody leaving the
-- platform — they would make account deletion impossible. A transaction-local
-- setting is the exemption; it cannot leak, because `set_config(..., true)`
-- is scoped to this transaction only.
create or replace function public.check_player_may_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  -- Account deletion, not somebody walking out of one game.
  if coalesce(current_setting('app.deleting_account', true), '') = 'on' then
    return old;
  end if;

  if auth.uid() is null then
    return old; -- cascade or service role
  end if;

  select created_by into v_created_by
  from games where id = old.game_id;

  if not found then
    return old;
  end if;

  if v_created_by = old.user_id then
    raise exception
      'The organiser cannot leave their own game — cancel the game instead'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from match_results where game_id = old.game_id) then
    raise exception
      'This game already has a match result, so its players are fixed'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

-- ── b) the deletion itself ───────────────────────────────────────────────
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

  -- Everything from here runs under the leave-guard exemption. Transaction
  -- scoped, so it is gone the moment this returns either way.
  perform set_config('app.deleting_account', 'on', true);

  -- ── GAMES THEY CREATED ─────────────────────────────────────────────────
  -- Cannot simply be deleted: other people joined them, chat hangs off them,
  -- and match results reference them. Three cases, decided per game:
  --
  --   future game, other players remain  → hand it to the longest-standing of
  --                                        them, so the game still happens and
  --                                        somebody can still edit or cancel it
  --   future game, nobody else in it     → cancel it; there is nothing to hand
  --                                        over and an ownerless live game can
  --                                        never be called off
  --   past or already cancelled          → leave it alone, just unlink the owner
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
      order by gp.ctid          -- no joined_at on this table; insertion order
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
      -- Live game, nobody to inherit it.
      update games set status = 'cancelled' where id = g.id;
    end if;
  end loop;

  -- Unlink the owner from whatever is left (past games, cancelled ones, and
  -- anything not handed over). Only if the column allows it — if the live
  -- table has created_by NOT NULL the orphan uuid stays, which is already
  -- anonymous once the profile below is gone: it resolves to no account, so
  -- nobody is ever the owner.
  select is_nullable = 'YES' into v_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'games'
    and column_name = 'created_by';

  if coalesce(v_nullable, false) then
    update games set created_by = null where created_by = v_uid;
  end if;

  -- ── GROUPS THEY CREATED ────────────────────────────────────────────────
  -- groups.created_by is NOT NULL, so it must be handed over or the group
  -- must go. A group whose only member was the departing person has nobody
  -- left to be in it; deleting it cascades its membership and messages.
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

  -- ── THEIR OWN ROWS ─────────────────────────────────────────────────────
  -- Nothing anybody else's record depends on. All hard deleted.

  -- Queue places for a person who no longer exists.
  delete from game_waitlist where user_id = v_uid;

  -- Roster rows. This fires promote_from_waitlist, which is exactly right:
  -- their spot opens and the next person in the queue takes it.
  delete from game_players where user_id = v_uid;

  delete from group_members where user_id = v_uid or added_by = v_uid;

  -- CHAT: deleted outright, and this is the one place the answer differs from
  -- match results. Nothing derives from a message — no stat, no rating, no
  -- integrity constraint — so removing them corrupts nobody's record. They are
  -- the person's own words, and erasing words somebody asked to have erased is
  -- the stronger position when nothing is owed to anyone else. The cost is
  -- accepted: a thread loses their side of the arrangement. The game row still
  -- holds the venue and the time, which is the part anybody needs.
  delete from messages where user_id = v_uid;

  -- A connection needs two people. The other side's count drops by one, which
  -- is the truth.
  delete from connections where requester_id = v_uid or addressee_id = v_uid;

  delete from notifications where user_id = v_uid;

  -- ── WHAT SURVIVES, DELIBERATELY ────────────────────────────────────────
  -- match_results, match_result_participants, match_result_entries,
  -- match_result_sets and match_result_absences are untouched. Deleting a
  -- participant row would silently rewrite three other players' Played, Won,
  -- rating and badge progress, and a half-deleted result could never finalise.
  -- The uuid stays for referential coherence; the identity behind it does not
  -- survive the profile delete two lines below.

  -- ── THE IDENTITY ───────────────────────────────────────────────────────
  -- Their avatar file. Deleting the storage.objects row is how the storage API
  -- removes a file; the physical object is reaped separately by Supabase, and
  -- is unreachable in the meantime because the path is keyed on the user id.
  delete from storage.objects
  where bucket_id = 'avatars'
    and (name = v_uid::text || '/avatar' or name like v_uid::text || '/%');

  -- The profile. THIS is the anonymisation: every uuid left in a shared record
  -- stops resolving to a person the moment this row goes.
  delete from profiles where id = v_uid;

  -- The account. Last, so that if anything above raises, the whole transaction
  -- rolls back and the person still has a working login.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ── c) notes ─────────────────────────────────────────────────────────────
-- ATOMICITY: a plpgsql function body is one transaction. Any exception —
-- a constraint, a trigger, a missing table — rolls back every statement above
-- it. There is no half-deleted account; the call either returns cleanly or
-- changes nothing.
--
-- The client's only job afterwards is to sign out. It must NOT delete anything
-- itself: a sequence of client calls is exactly the thing that can fail
-- halfway.
--
-- PRE-FLIGHT — this function names every table the app uses. If any of these
-- do not exist under these names it will raise at runtime (plpgsql resolves
-- bodies at execution). Check first:
--
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('profiles','games','game_players','game_waitlist',
--                        'connections','messages','groups','group_members',
--                        'notifications','match_results',
--                        'match_result_participants');
--
-- Worth also confirming what the dashboard-made tables do on auth.users
-- delete, even though this function makes it moot by cleaning first:
--
--   select tc.table_name, kcu.column_name, rc.delete_rule
--   from information_schema.table_constraints tc
--   join information_schema.key_column_usage kcu using (constraint_name)
--   join information_schema.referential_constraints rc using (constraint_name)
--   where tc.constraint_type = 'FOREIGN KEY';
--
-- DEPENDS ON: 20260909 (defines check_player_may_leave, superseded here),
-- 20260910 (game_waitlist table and the promotion trigger). Run it after both.
