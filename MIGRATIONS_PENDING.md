# Migrations

Database changes in this repo are **applied by hand in the Supabase SQL editor**,
never with `supabase db push`. Two reasons, both still true:

- The Supabase CLI isn't set up here — there's no `supabase/config.toml` and no
  linked project.
- Every migration below was run by hand, so Supabase holds **no migration
  history** for any of them. A `db push` would find that history empty and try
  to re-run every file from June onward — including two that rewrite live data
  (ratings, and every game time).

So: a migration gets written into `supabase/migrations/`, printed for review,
and added to **Pending** below. **Writing one never applies it.**

## How to apply one

1. Do its PRE-FLIGHT step first, if it has one.
2. Supabase dashboard → SQL editor → New query.
3. Paste the file's contents and run it.
4. Move its entry from Pending to Applied, with the date.

Every file is written to be idempotent, so a part-finished run can be retried
from the top.

## Pending

Nothing. Every file in `supabase/migrations/` has been applied.

## Applied

All twelve run by hand in the SQL editor on **2026-09-11**, in filename order.

| File | What it added |
|---|---|
| `20260810000000_recurring_games.sql` | `recurs_weekly`, `series_id`, and the hourly `pg_cron` job that rolls a weekly game forward |
| `20260811000000_dublin_wall_clock.sql` | True-UTC storage with Dublin display, plus the one-shot backfill that shifted every existing game time |
| `20260812000000_ratings.sql` | `profiles.rating`, `rating_applied`, the Elo triggers, and a full rebuild from confirmed results |
| `20260908000000_game_price_and_manual_close.sql` | `price_per_player` (nullable) and `is_manually_closed` |
| `20260909000000_player_leaves_game.sql` | RLS on `game_players`, the leave DELETE policy, the two refusals, and the organiser notification |
| `20260910000000_game_waitlist.sql` | The `game_waitlist` table and the promotion trigger that skips hand-closed games |
| `20260911000000_attendance_and_reliability.sql` | `attended`, `match_result_absences`, and the three-argument `submit_result_entry` |
| `20260912000000_public_game_read.sql` | Anon SELECT on `games` and `game_players`, so shared links open for signed-out people |
| `20260913000000_delete_account.sql` | `delete_my_account()` — the whole deletion in one transaction |
| `20260914000000_blocks.sql` | The `blocks` table, its one-directional RLS, and the connection-dropping trigger |
| `20260915000000_reports.sql` | `reports`, `profiles.is_admin`, `is_admin()`, rate limiting, and the admin notification |
| `20260916000000_onboarding.sql` | `profiles.onboarded_at` |

### Two follow-ups those files asked for

Worth confirming both were done, because neither is visible from the schema:

- **Make yourself an admin.** `20260915` ships the moderation queue, but
  `/admin/reports` returns nothing until this runs — the gate is RLS, not the
  page:

  ```sql
  update profiles set is_admin = true where id = '<your user uuid>';
  ```

- **Deploy the app code.** `20260911` replaced `submit_result_entry` with a
  three-argument version. The old client calls the two-argument form, so until
  the deploy lands, submitting a scoresheet fails.
