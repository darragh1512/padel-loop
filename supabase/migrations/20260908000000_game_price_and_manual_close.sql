-- supabase/migrations/20260908000000_game_price_and_manual_close.sql
-- GAME PRICE + MANUAL CLOSE: the two columns going onto `games` this week.
-- Both are added here in one pass so the table is only altered once, but they
-- are independent — shipping order is price now, manual close next.
--
-- Every statement is idempotent, so a partial run can be retried from the top.
--
--   • price_per_player — what ONE player pays, in euro. NOT the total court
--     cost: do not divide it by max_players anywhere. Nullable on purpose,
--     and null means "the organiser hasn't set a price", which is a different
--     thing from a price of zero. A free game is 0.00; an unpriced game is
--     null. Screens must render nothing at all for null (no €0.00, no "Free",
--     no bare euro sign).
--
--   • is_manually_closed — the organiser's override to stop new joins while
--     spots are still technically open. NOT NULL default false, so every
--     existing row is "not manually closed" the moment this runs. Added now,
--     deliberately unused by the app until the follow-up change lands.

-- ── a) columns ───────────────────────────────────────────────────────────
-- numeric(6,2) = up to 9999.99, exact to the cent. Deliberately NOT a float:
-- money must not carry binary rounding error.
alter table public.games
  add column if not exists price_per_player numeric(6,2);

alter table public.games
  add column if not exists is_manually_closed boolean not null default false;

-- ── b) price sanity ──────────────────────────────────────────────────────
-- Negative prices are meaningless and the forms already block them; this is
-- the backstop that holds regardless of which client writes the row. Null
-- stays allowed — that is the "no price set" case.
-- Postgres has no "add constraint if not exists", hence the guard.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'games_price_per_player_non_negative'
      and conrelid = 'public.games'::regclass
  ) then
    alter table public.games
      add constraint games_price_per_player_non_negative
      check (price_per_player is null or price_per_player >= 0);
  end if;
end $$;

-- ── c) notes ─────────────────────────────────────────────────────────────
-- No RLS changes needed: both columns sit on `games`, which already has its
-- policies (creator writes, everyone reads), and Postgres RLS is row-level,
-- so the existing UPDATE policy covers the new columns automatically.
--
-- No backfill needed: price_per_player is meant to be null on every existing
-- row (nobody has set a price yet), and is_manually_closed takes its default.

comment on column public.games.price_per_player is
  'Euro amount ONE player pays. Null = no price set (render nothing). 0 = free.';

comment on column public.games.is_manually_closed is
  'Organiser override: stop new joins even while spots remain. Unused until the follow-up change.';
