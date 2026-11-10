-- supabase/migrations/20261110120000_protect_profile_columns.sql
-- LOCK THE ADMIN FLAG AND RATING: players can no longer set their own.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- THE GAP. Players are allowed to create and edit their own row in profiles
-- (the "Users can insert own profile" and "Users can update own profile"
-- rules), and that permission covers every column. Nothing stopped a player,
-- calling the database directly with their own sign-in, from:
--   • creating their profile with is_admin = true, or a rating of their
--     choosing, at sign-up (the existing guard rule only runs on UPDATE);
--   • possibly also changing them later, depending on what the existing
--     guard_profile_privileged_columns() rule checks.
-- The app itself never sends either column, so normal sign-up and profile
-- saves are unaffected.
--
-- THE FIX. One new rule, run before every profile is created or changed:
--   • when a PLAYER creates a profile: is_admin is always false, and the
--     rating is always the starting rating for their stated level;
--   • when a PLAYER changes a profile: any change to is_admin or rating is
--     refused with a sentence.
-- "A player" means a request made with a player's sign-in (the authenticated
-- or anon role). The database's own functions are not players: confirming a
-- match moves ratings through apply_result_rating(), which runs with the
-- database's permissions, so ratings keep updating as before. Changes made in
-- the Supabase dashboard (how admins are granted) are not affected either.
--
-- It adds a rule and changes no existing row: current admins stay admins and
-- every rating stays as it is. The existing guard rule is left in place.

-- ── a) the rule ──────────────────────────────────────────────────────────
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Not SECURITY DEFINER on purpose: current_user is whoever is making the
  -- change, so a player's request reads as authenticated (or anon), while the
  -- database's own functions and the dashboard read as their owner.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_admin := false;
    new.rating := public.skill_base_rating(new.skill_level);
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin then
    raise exception 'Only Padel Loop can change who is an admin.' using errcode = '42501';
  end if;
  if new.rating is distinct from old.rating then
    raise exception 'Ratings change only through confirmed match results.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_columns on public.profiles;
create trigger trg_protect_profile_columns
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_columns();

comment on function public.protect_profile_columns() is
  'Players cannot set is_admin or rating on their own profile; only the database''s own functions and the dashboard can.';
