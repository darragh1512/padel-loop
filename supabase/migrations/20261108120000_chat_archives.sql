-- supabase/migrations/20261108120000_chat_archives.sql
-- ARCHIVED CHATS, and cancelled games dropping off everyone's pins.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- An archive is PERSONAL, like a pin: a row here means "this person has moved
-- this chat into the Archived section of THEIR Chats tab". Nobody else can see,
-- add or remove it, so archiving never changes anyone else's list. Nothing is
-- deleted: the chat and its messages stay exactly as they are.
--
-- Adds only a new table, its rules and two triggers. No existing row or column
-- is changed, and no existing function is replaced.

-- ── a) the archive ───────────────────────────────────────────────────────
-- Points at EITHER a game chat or a group chat, never both — the same shape
-- as chat_pins. Deleting the game or group removes the row with it.
create table if not exists public.chat_archives (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users (id)    on delete cascade,
  game_id     bigint      references public.games (id)           on delete cascade,
  group_id    bigint      references public.groups (id)          on delete cascade,
  archived_at timestamptz not null default now(),
  constraint chat_archives_one_target
    check ((game_id is null) <> (group_id is null))
);

-- You can archive a given chat once.
create unique index if not exists chat_archives_user_game_uidx
  on public.chat_archives (user_id, game_id) where game_id is not null;
create unique index if not exists chat_archives_user_group_uidx
  on public.chat_archives (user_id, group_id) where group_id is not null;

-- ── b) who may read and write archives: only you, only your own ──────────
-- Archiving needs you to be in the chat: the same membership rule as pinning,
-- through can_pin_chat (from 20260928010000_chat_pins.sql).
alter table public.chat_archives enable row level security;

drop policy if exists "Read your own archived chats" on public.chat_archives;
create policy "Read your own archived chats"
  on public.chat_archives for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Archive a chat you are in" on public.chat_archives;
create policy "Archive a chat you are in"
  on public.chat_archives for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_pin_chat(auth.uid(), game_id, group_id)
  );

drop policy if exists "Unarchive your own chats" on public.chat_archives;
create policy "Unarchive your own chats"
  on public.chat_archives for delete
  to authenticated
  using (user_id = auth.uid());

-- No UPDATE policy: an archive is added or removed, never edited.

-- ── c) leaving a chat drops your archive of it ───────────────────────────
-- So rejoining a game or group later doesn't find its chat still tucked away.
-- The game version keeps the organiser's, since the organiser keeps chat access.
-- New functions and triggers of their own; the pin ones are untouched.
create or replace function public.unarchive_on_leave_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from chat_archives a
  where a.user_id = old.user_id
    and a.game_id = old.game_id
    and not exists (
      select 1 from games g
      where g.id = old.game_id and g.created_by = old.user_id
    );
  return old;
end;
$$;

drop trigger if exists trg_unarchive_on_leave_game on public.game_players;
create trigger trg_unarchive_on_leave_game
  after delete on public.game_players
  for each row
  execute function public.unarchive_on_leave_game();

create or replace function public.unarchive_on_leave_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from chat_archives
  where user_id = old.user_id and group_id = old.group_id;
  return old;
end;
$$;

drop trigger if exists trg_unarchive_on_leave_group on public.group_members;
create trigger trg_unarchive_on_leave_group
  after delete on public.group_members
  for each row
  execute function public.unarchive_on_leave_group();

-- ── d) cancelling a game unpins it for everyone ──────────────────────────
-- A cancelled game's chat moves to Archived for every player, so nobody's pin
-- on it should keep holding one of their three places. The app also drops
-- such pins when Chats opens; this does it at the moment of cancelling.
-- Runs only when status actually changes to cancelled.
create or replace function public.unpin_cancelled_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(btrim(coalesce(new.status, ''))) = 'cancelled'
     and lower(btrim(coalesce(old.status, ''))) is distinct from 'cancelled' then
    delete from chat_pins where game_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_unpin_cancelled_game on public.games;
create trigger trg_unpin_cancelled_game
  after update of status on public.games
  for each row
  execute function public.unpin_cancelled_game();

comment on table public.chat_archives is
  'Chats a person moved into the Archived section of their own Chats tab. Personal; hides nothing from anyone else.';
