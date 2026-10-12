-- supabase/migrations/20260928010000_chat_pins.sql
-- PINNED CHATS: each person can pin up to three chats to the top of their
-- own Chat tab.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- A pin is PERSONAL: a row here means "this person wants this chat at the top
-- of THEIR list". Nobody else can read, add or remove it, so pinning never
-- changes anyone else's Chat tab.
--
-- The rules, all enforced here rather than trusted to the app:
--   • you can only pin a chat you are actually in (a game you joined or
--     created, or a group you are a member of);
--   • at most THREE pins per person — a fourth is refused with a sentence;
--   • leaving a game or group drops your pin on it, so a chat you can no
--     longer see can't quietly hold one of your three slots.

-- ── a) the pins ──────────────────────────────────────────────────────────
-- A pin points at EITHER a game chat or a group chat, never both — the same
-- shape as messages (game_id xor group_id).
create table if not exists public.chat_pins (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users (id)    on delete cascade,
  game_id    bigint      references public.games (id)           on delete cascade,
  group_id   bigint      references public.groups (id)          on delete cascade,
  pinned_at  timestamptz not null default now(),
  constraint chat_pins_one_target
    check ((game_id is null) <> (group_id is null))
);

-- You can pin a given chat once.
create unique index if not exists chat_pins_user_game_uidx
  on public.chat_pins (user_id, game_id) where game_id is not null;
create unique index if not exists chat_pins_user_group_uidx
  on public.chat_pins (user_id, group_id) where group_id is not null;

-- ── b) is this person in this chat? ──────────────────────────────────────
-- Same membership rule the app uses for chat access (canUserChat): a game
-- chat is for its players and its organiser; a group chat is for members.
-- SECURITY DEFINER so it can look at game_players / group_members whatever
-- their own read policies say.
create or replace function public.can_pin_chat(
  p_user_id  uuid,
  p_game_id  bigint,
  p_group_id bigint
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case
    when p_game_id is not null then
      exists (
        select 1 from public.game_players
        where game_id = p_game_id and user_id = p_user_id
      )
      or exists (
        select 1 from public.games
        where id = p_game_id and created_by = p_user_id
      )
    when p_group_id is not null then
      public.is_group_member(p_group_id, p_user_id)
    else false
  end;
$$;

grant execute on function public.can_pin_chat(uuid, bigint, bigint) to authenticated;

-- ── c) who may read and write pins: only you, only your own ──────────────
alter table public.chat_pins enable row level security;

drop policy if exists "Read your own pins" on public.chat_pins;
create policy "Read your own pins"
  on public.chat_pins for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Pin a chat you are in" on public.chat_pins;
create policy "Pin a chat you are in"
  on public.chat_pins for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_pin_chat(auth.uid(), game_id, group_id)
  );

drop policy if exists "Unpin your own pins" on public.chat_pins;
create policy "Unpin your own pins"
  on public.chat_pins for delete
  to authenticated
  using (user_id = auth.uid());

-- No UPDATE policy: a pin is added or removed, never edited.

-- ── d) the three-pin limit ───────────────────────────────────────────────
-- A trigger, not a policy, so it can refuse with a readable sentence. The
-- advisory lock is per person: two pins tapped in the same instant queue up
-- and the second one sees the first, so nobody can squeeze in a fourth.
create or replace function public.check_chat_pin_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('chat_pins:' || new.user_id::text));

  if (select count(*) from chat_pins where user_id = new.user_id) >= 3 then
    raise exception 'You can pin up to 3 chats. Unpin one first.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_chat_pin_limit on public.chat_pins;
create trigger trg_check_chat_pin_limit
  before insert on public.chat_pins
  for each row
  execute function public.check_chat_pin_limit();

-- ── e) leaving a chat drops your pin on it ───────────────────────────────
-- Leaving a game (or being removed by its organiser) and leaving a group
-- both delete a membership row. When that happens, the person's pin on that
-- chat goes too. The game version keeps the pin if they are still the
-- organiser, since the organiser keeps chat access.
create or replace function public.unpin_on_leave_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from chat_pins p
  where p.user_id = old.user_id
    and p.game_id = old.game_id
    and not exists (
      select 1 from games g
      where g.id = old.game_id and g.created_by = old.user_id
    );
  return old;
end;
$$;

drop trigger if exists trg_unpin_on_leave_game on public.game_players;
create trigger trg_unpin_on_leave_game
  after delete on public.game_players
  for each row
  execute function public.unpin_on_leave_game();

create or replace function public.unpin_on_leave_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from chat_pins
  where user_id = old.user_id and group_id = old.group_id;
  return old;
end;
$$;

drop trigger if exists trg_unpin_on_leave_group on public.group_members;
create trigger trg_unpin_on_leave_group
  after delete on public.group_members
  for each row
  execute function public.unpin_on_leave_group();

comment on table public.chat_pins is
  'Chats a person pinned to the top of their own Chat tab. Personal, max 3 per person.';
