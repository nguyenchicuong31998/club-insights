# How it is built

## Data

`backend/data/*.csv` is the club export the dashboard is built on. Timestamps are UTC (ISO-8601 with `Z`);
`created_at` and `joined_club_at` are calendar dates.

| File | Rows | Columns |
|---|---|---|
| `clubs.csv` | 2 | `club_id, name, time_zone, created_at` |
| `players.csv` | 260 | `player_id, club_id, name, joined_club_at`. Each player is a member of one club. |
| `sessions.csv` | 195 | `session_id, club_id, title, starts_at, duration_minutes, places, status, attendance_recorded`. Status is `scheduled` or `cancelled`. |
| `bookings.csv` | 1,893 | `booking_id, session_id, player_id, booked_at, status, cancelled_at, attended`. Status is `booked` or `cancelled`; attended is `true`, `false` or blank. |

**Attendance is taken per session.** When `attendance_recorded` is `false`, nobody checked players in. Every
booking at that session then has unknown attendance (`NULL`), never `false`, so it counts as neither present
nor absent. In this export, 104 sessions recorded attendance (913 present, 86 no-shows) and 91 did not
(734 bookings with unknown attendance).

What the export contains, and how the dashboard deals with it:

- **Club time zone.** *Early Bird Monday* starts at 05:30 on Monday in Saigon, which is 22:30 on Sunday in UTC. Weeks are cut in local time, so it lands in the right week.
- **Missing attendance.** Almost half the sessions have no attendance. No-shows are counted only where attendance was taken, and the coverage is shown beside them.
- **Cancellations.** There are 9 cancelled sessions (none of them have bookings) and 160 cancelled bookings. Neither ever counts.
- **"Now".** The last session is Sun 4 Oct 18:00 local, just before "now" (Mon 5 Oct 09:00). So the current week has no sessions yet.
- **New club.** Thảo Điền Tennis Club was created on 1 Oct 2026 and has no players or sessions.
- **Players with the same name.** Two pairs of different players share a name. Lists show the player id as well, so they can be told apart.

`npm run db:seed` checks each row before loading it and prints what it skipped or corrected, with file and line:

- **Skipped:** rows with a missing or unknown parent; a player booked at a club they don't belong to; impossible dates (such as `2026-02-30`) or timestamps without an offset; a second live booking by the same player for the same session; a cancelled booking without `cancelled_at`; a cancelled booking with attendance.
- **Corrected:** an `attended` value on a session with `attendance_recorded=false` is ignored.

The database enforces the same rules with `CHECK` constraints and a unique index.

## Backend layers

Dependencies point inward only: `interfaces → application → domain`, with
`infrastructure` implementing interfaces that `domain` declares.

| Layer | Folder | Holds |
|---|---|---|
| Domain | `src/domain` | Entities, repository interfaces, and **all metric logic** as pure functions: `time/` (local dates, club time zone → UTC, Monday–Sunday weeks, previous period) and `metrics/` (sessions held, active players, no-shows with coverage, changes, drill-down rows, definitions). No framework or DB imports. |
| Application | `src/application` | Use cases: `ListClubs`, `GetClub`, `GetClubSummary`, `GetWeeklySeries`, `ListSessionsBehindMetric`, `ListPlayersBehindMetric`, `GetSessionDetail`. `ClubPeriodReader` resolves and validates the date range; the `Clock` port supplies the fixed "now". |
| Infrastructure | `src/infrastructure` | `pg` pool, migration runner, CSV seed loader, `FixedClock`, and `PgClubRepository` / `PgSessionRepository`. |
| Interfaces | `src/interfaces/http` | Express app, routes, controllers, zod query schemas, error → HTTP status mapping (validation 400, not found 404). |
| Composition root | `src/container.ts`, `src/main.ts` | `buildApp` in `container.ts` is the only place that wires concrete classes together; the API tests use it too. `main.ts` reads config and starts the server. |
| CLI | `src/cli` | One-off commands (`migrate.ts`, `seed.ts`). |

**Why the numbers are computed in TypeScript, not SQL.** The repository returns the sessions in a
range with their live (not cancelled) bookings, and the domain functions compute every number from that one
input. The summary cards, the weekly chart and the drill-down lists therefore share one code
path, so a headline number always equals the length of the list behind it, and the logic can be
unit-tested without a database. A four-week range is about 300 bookings. Moving the aggregation into
SQL is listed under next steps for clubs with far more data.

To add a feature: entity/interface in `domain` → use case in `application` →
Postgres implementation in `infrastructure` → controller + route in `interfaces` → wire in `container.ts`.

## Tests

```bash
npm test                      # repo root: starts and seeds Postgres if needed, then runs everything
npm --prefix backend test     # tests only; the API tests are skipped, with a message, if there is no seeded database
```

The tests use Vitest and live in `backend/test`. There are 64 of them.

| File | What it checks |
|---|---|
| `domain/noShows.test.ts` | **No-shows, the number most likely to be wrong.** No attendance taken gives Unknown (`null`), never 0. Everyone attending gives a real 0. With attendance taken for only some bookings, the rate divides by the recorded bookings only: 3 of 11, not 3 of 22. Coverage is reported. Cancelled and future sessions never count. The rate change is null when either side is Unknown. The drill-down lists add up to the headline number. Attendance is broken down per recurring session. |
| `domain/time.test.ts` | **Weeks in the club's time zone.** Sunday 23:30 in Saigon stays in the week that is ending. Monday 00:30, which is still Sunday 17:30 in UTC, starts the new week, and so does *Early Bird Monday* at 05:30. Inclusive local ranges become half-open UTC intervals. DST and half-hour zones work. Invalid dates are rejected. The default range and the partial-week flags are correct. |
| `domain/periods.test.ts` | **Comparisons.** The previous period has the same length, including across month ends and leap days. The change is correct, and its relative part is null (not Infinity) when the previous value is 0. "Today" is the club's local date. Bad ranges are rejected. |
| `application/weekly.test.ts` | **Use cases over in-memory repositories.** Sessions at the edges of a range or a week land in the right bucket. Unknown no-shows stay separate from 0, week by week. A new club has no history. |
| `integration/api.test.ts` | **The HTTP API on the seeded Postgres data,** checked against the hand-computed values in [metrics.md](metrics.md): 20/20 sessions, 89/88 active players, 15 no-shows of 151 recorded vs 14 of 152, every weekly value, and the local 5/5 split of sessions across 7–20 Sep (UTC would give 1/5/4). Each list adds up to its number. A session without attendance shows only "not recorded". Players with the same name stay separate. The empty club works. Errors return 400 and 404. |
| `infrastructure/readCsvData.test.ts` | **The CSV loader.** Columns are mapped and the end time is derived. Blank attendance stays unknown. Impossible dates such as `2026-02-30`, timestamps without an offset, bad numbers and flags are rejected, as are a second live booking by the same player, a player from another club, and inconsistent cancellations. Attendance on a session without attendance is ignored and reported. The real export loads with no rejected rows. |

To make sure the tests can fail, two bugs were added on purpose and then removed: dividing no-shows by all bookings, and bucketing weeks in UTC. Together they made 7 tests fail.

## Frontend

A Next.js app-router project. `src/app/page.tsx` is a server component that calls the API; only the chart,
the range picker, the club switcher and the drawer run in the browser. All state lives in the URL
(`?club=&from=&to=&chart=&view=&session=`), so any view can be shared or bookmarked and the back button works.

The page reads top to bottom as the host's questions:

| Part | Answers | Component |
|---|---|---|
| Header | Which club, and "as of when" in the club's own time zone | `ClubSwitcher`, `page.tsx` |
| Range tabs | Which weeks, compared with which weeks (both always printed) | `RangeControls` |
| Summary sentence | "Are more people playing?" in one sentence, plus how much attendance the no-shows rest on | `Headline` |
| Three numbers | Value, change with arrow and words, a one-line definition, and a link to the list behind it. No-shows show one square per session, filled where attendance was taken, and *Unknown* rather than 0 | `MetricCard` |
| Week by week | One metric at a time; the previous period in a lighter tint; partial weeks hatched; weeks without attendance marked "?"; tooltip, keyboard stepping and a table view | `WeeklyChart` (hand-written SVG) |
| Who didn't show up | The players behind the no-shows, worst first | `NoShowDetails` |
| Where the rate comes from | Attendance per recurring session, so it is obvious when the rate leaves a session out (Saturday Morning Social took none) | `NoShowDetails` |
| How it's counted | The rules in plain words | `page.tsx` |
| Drawer | The five lists behind the numbers, and every booking of a session as Attended / No-show / Not recorded | `Drawer`, `DrillDown` |

The new club gets its own page (`EmptyClub`): when it was created, the three numbers as placeholders with when
each will appear, and three habits that make the numbers trustworthy from the first week.

Design: one accent (court green) carries the data; red and amber only mean "worse" and "read with care", always
with an arrow or words as well. Be Vietnam Pro renders Vietnamese names properly. Light and dark themes come
from the same tokens in `globals.css`. Built for a laptop; on a phone the columns stack and wide tables scroll
inside their own box, never the page. Loading, error and bad-range states are designed too.
