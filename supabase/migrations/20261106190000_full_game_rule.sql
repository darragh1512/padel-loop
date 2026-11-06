-- Stop anyone joining a game that is already full.
--
-- Until now only the app's screens prevented this, so someone looking at an
-- out-of-date screen, or two people tapping Join for the last spot at the same
-- moment, could overfill a game. Now the database refuses, and guests count as
-- taken spots.
--
-- It only checks a player adding THEMSELVES, which is the only way the app adds
-- anyone. Weekly games copying their players and the waitlist moving someone in
-- both happen inside the database and already decide for themselves, so a game
-- that is already over its limit can still roll forward to next week.
--
-- Nothing existing is edited: no game or player changes, a game already over its
-- limit stays as it is, and no existing function is replaced. Re-running is safe.
--
-- Run order: after 20261106120000_game_guests.sql. No pre-flight. Safe before or
-- after the app deploy. The current app already says "Couldn't join" when a join
-- is refused; the new design says the game has filled up.

-- ── a) stop if guests aren't there yet ───────────────────────────────────
do $check$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'guest_count'
  ) then
    raise exception 'STOPPED, nothing changed: games.guest_count does not exist. Send this message to Claude.';
  end if;
end;
$check$;

-- ── b) the rule ──────────────────────────────────────────────────────────
-- Locking the game's row makes two people going for the last spot take turns, so
-- the second one sees the spot has gone.
create or replace function public.check_game_has_space()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g       record;
  players int;
begin
  if new.user_id is distinct from auth.uid() then
    return new; -- not somebody joining by themselves: see the note above
  end if;

  select max_players, guest_count into g
  from games where id = new.game_id
  for update;

  if not found then
    return new; -- the existing rules deal with a game that doesn't exist
  end if;

  select count(*) into players from game_players where game_id = new.game_id;

  if players + g.guest_count >= g.max_players then
    raise exception 'This game is full.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_game_has_space on public.game_players;
create trigger trg_check_game_has_space
  before insert on public.game_players
  for each row
  execute function public.check_game_has_space();

revoke all on function public.check_game_has_space() from public, anon, authenticated;
