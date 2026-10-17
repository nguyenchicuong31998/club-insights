# Club Insights

A dashboard showing a club host how their club is doing.

```
club-insights/
├── docker-compose.yml   PostgreSQL 16 (host port 5434)
├── backend/             JSON API: Express 5 + TypeScript, clean architecture
└── frontend/            Next.js 15 app that reads only from the API
```

## Run it

Requires Node 22+ and Docker Desktop (running).

```bash
npm start
```

That one command installs dependencies, starts Postgres (Docker, host port 5434), applies
migrations, loads the sample CSVs if the database is empty, then runs the API on
http://localhost:4000 and the web app on http://localhost:3000. Later runs can use `npm run dev`,
which skips the install. No `.env` is needed: the defaults match `docker-compose.yml`. Copy
`backend/.env.example` to `backend/.env` only to override them.

| Command | Does |
|---|---|
| `npm run db:migrate` | Applies any `backend/db/migrations/NNN_*.sql` not yet in `schema_migrations`, each in its own transaction. Safe to repeat. |
| `npm run db:seed` | Reloads all four CSVs, replacing existing rows in one transaction. Prints CSV rows vs valid rows vs rows in the database, and lists every rejected row with file, line and reason. |
| `npm test` | Starts and seeds Postgres if needed, then runs every backend test (see [Tests](#tests)). |
| `npm run check` | Typechecks the backend (source and tests) and the frontend, then lints the frontend. |
| `npm run db:check` | Recomputes the headline numbers in plain SQL ([docs/spot-check.sql](docs/spot-check.sql)), independently of the TypeScript code, to compare with the dashboard. |
| `npm run db:reset` | Deletes the Postgres volume, then migrates and seeds from scratch. |

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

## Metrics

Every definition (active players, sessions held, no-shows, weeks, "now", comparison period) is in
[docs/metrics.md](docs/metrics.md), together with hand-checked expected values for the sample data.

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

The tests use Vitest and live in `backend/test`. There are 62 of them.

| File | What it checks |
|---|---|
| `domain/noShows.test.ts` | **No-shows, the number most likely to be wrong.** No attendance taken gives Unknown (`null`), never 0. Everyone attending gives a real 0. With attendance taken for only some bookings, the rate divides by the recorded bookings only: 3 of 11, not 3 of 22. Coverage is reported. Cancelled and future sessions never count. The rate change is null when either side is Unknown. The drill-down lists add up to the headline number. |
| `domain/time.test.ts` | **Weeks in the club's time zone.** Sunday 23:30 in Saigon stays in the week that is ending. Monday 00:30, which is still Sunday 17:30 in UTC, starts the new week, and so does *Early Bird Monday* at 05:30. Inclusive local ranges become half-open UTC intervals. DST and half-hour zones work. Invalid dates are rejected. The default range and the partial-week flags are correct. |
| `domain/periods.test.ts` | **Comparisons.** The previous period has the same length, including across month ends and leap days. The change is correct, and its relative part is null (not Infinity) when the previous value is 0. "Today" is the club's local date. Bad ranges are rejected. |
| `application/weekly.test.ts` | **Use cases over in-memory repositories.** Sessions at the edges of a range or a week land in the right bucket. Unknown no-shows stay separate from 0, week by week. A new club has no history. |
| `integration/api.test.ts` | **The HTTP API on the seeded Postgres data,** checked against the hand-computed values in [docs/metrics.md](docs/metrics.md): 20/20 sessions, 89/88 active players, 15 no-shows of 151 recorded vs 14 of 152, every weekly value, and the local 5/5 split of sessions across 7–20 Sep (UTC would give 1/5/4). Each list adds up to its number. A session without attendance shows only "not recorded". Players with the same name stay separate. The empty club works. Errors return 400 and 404. |
| `infrastructure/readCsvData.test.ts` | **The CSV loader.** Columns are mapped and the end time is derived. Blank attendance stays unknown. Impossible dates such as `2026-02-30`, timestamps without an offset, bad numbers and flags are rejected, as are a second live booking by the same player, a player from another club, and inconsistent cancellations. Attendance on a session without attendance is ignored and reported. The real export loads with no rejected rows. |

To make sure the tests can fail, two bugs were added on purpose and then removed: dividing no-shows by all bookings, and bucketing weeks in UTC. Together they made 7 tests fail.

## Frontend

The frontend is a Next.js app router project. `src/app/page.tsx` is a server component that calls the API.
All state lives in the URL: `?club=&from=&to=&chart=&view=&session=`. Any view can be shared or bookmarked,
and the back button works.

**Main parts of the page**

- **Header.** A club switcher, the fixed "now", and the club's time zone. All times on the page are shown in the club's time zone, not the viewer's.
- **Range bar.**
  - Presets for the last 4, 12 or 26 complete weeks, plus a custom range.
  - It always prints the exact comparison dates, for example "7 Sept – 4 Oct 2026 · compared with 10 Aug – 6 Sept 2026".
  - It flags a range that includes today, since that range is not over yet.

**Key numbers**

There are three cards. Each shows the value, the previous value, and the change as an arrow plus text, never color alone. Each also shows its definition under the number and links to the list behind it.

- **When the previous period is zero.** If a club has no sessions in the previous period, the card says there is nothing to compare. It does not show a misleading "+61".
- **No-show card.**
  - Shows the count and the rate, with a coverage bar ("attendance taken for 151 of 264 bookings").
  - Compares the *rate*, in percentage points.
  - Shows **Unknown**, never 0, when no attendance was taken.

**Weekly chart**

- One metric at a time: active players, sessions held, or no-show rate.
- Shows the previous period in a muted tone beside the selected range, for context.
- Weeks are marked when they are partial (cut by the range, or still in progress) or have no attendance taken.
- Has a hover or focus tooltip, keyboard stepping, and a "Show as table" view.
- The chart is hand-written SVG, with no chart library.

**Drill-down**

- A drawer opens from any card. It is full screen on a phone and closes with Esc.
- It has five lists: sessions held, active players, players who didn't show, sessions with no-shows, and sessions missing attendance.
- Clicking a session lists every booking as **Attended**, **No-show** or **Not recorded**, plus the cancelled bookings that are not counted.

**Empty club**

The new club gets an explanation instead of zeros: when it was created, what each number will show and when, and a tip to take attendance from the first session.

**Other states**

- Loading skeleton.
- Error page with retry.
- A readable message for a bad date range, with a reset link.
- Light and dark themes driven by the same color tokens (`globals.css`).
- The layout is built for a laptop. On a phone, the cards stack and wide tables scroll inside their box, never the page.

## API

The API returns JSON only and is designed to be reused by the mobile app as is. Clients never do time zone
math or interpret raw attendance values.

### Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }` |
| GET | `/api/clubs` | All clubs (for the switcher). |
| GET | `/api/clubs/:id` | One club. |
| GET | `/api/clubs/:id/summary?from&to` | The three metrics for the range and the previous period, with changes, coverage and definitions. |
| GET | `/api/clubs/:id/weekly?from&to` | All three metrics for every Monday–Sunday week overlapping the range. |
| GET | `/api/clubs/:id/sessions?from&to&filter` | The sessions behind a number. `filter`: `held` (default), `with_no_shows`, `attendance_not_recorded`. Newest first. |
| GET | `/api/clubs/:id/players?from&to&filter` | The players behind a number. `filter`: `active` (default), `no_show`. |
| GET | `/api/clubs/:id/sessions/:sessionId` | One session, with each booking labelled `attended`, `no_show` or `not_recorded`, plus a count of cancelled bookings. |

### Query parameters

- `from` and `to` are inclusive local dates (`YYYY-MM-DD`) in the club's time zone.
- Pass both or neither. Without them, the range is the last four complete weeks before now.
- The range can be at most 366 days and must not start after today.

### Response shape

Range endpoints return `{ data, meta }`. `meta` holds:

| Field | Meaning |
|---|---|
| `timezone`, `now`, `today` | The club's time zone, the fixed "now", and today's date in that zone. |
| `range` | `from`, `to`, `startUtc`, `endUtc`, and `partial` (true when the range reaches today, so part of it has not happened yet). |
| `previousRange` | The comparison period, in the same form. |
| `definitions` | The plain-language definition of each metric, to show next to it. |

### Values

| Value | Meaning |
|---|---|
| Timestamps | ISO-8601 in UTC. |
| Rates and relative changes | Fractions: `0.117` means 11.7%. |
| `change: null` | One side is unknown. Show "—". |
| `relative: null` | The previous value was 0. |
| `noShows.count: null` and `noShows.rate: null` | Unknown, because no attendance was taken in that period. Show "Unknown", never 0. |
| `recordedBookings` / `confirmedBookings` | The attendance coverage to show beside the number. `confirmedBookings` counts live bookings (status `booked` in the data), not cancelled ones. |
| `hasHistory: false` | The club has never held a session. Show the empty state instead of zeros. |

### Errors

Errors return `{ "error": "<message the user can read>" }`:

| Status | When |
|---|---|
| 400 | Invalid date or filter, `from` after `to`, only one of the two dates given, or a range that is too long or starts after today. |
| 404 | Unknown club, unknown session, a session that belongs to another club, or an unknown route. |

Example:

```bash
curl "localhost:4000/api/clubs/club-001/summary?from=2026-09-07&to=2026-10-04"
```

```jsonc
{
  "data": {
    "club": { "id": "club-001", "name": "Saigon Smash Pickleball", "timezone": "Asia/Ho_Chi_Minh", "createdOn": "2025-12-01" },
    "firstSessionAt": "2026-01-04T22:30:00.000Z",
    "hasHistory": true,
    "metrics": {
      "sessionsHeld":  { "current": 20, "previous": 20, "change": { "absolute": 0, "relative": 0 }, "definition": "..." },
      "activePlayers": { "current": 89, "previous": 88, "change": { "absolute": 1, "relative": 0.0114 }, "definition": "..." },
      "noShows": {
        "current":  { "count": 15, "rate": 0.0993, "recordedBookings": 151, "confirmedBookings": 264, "sessionsWithAttendance": 11 },
        "previous": { "count": 14, "rate": 0.0921, "recordedBookings": 152, "confirmedBookings": 248, "sessionsWithAttendance": 12 },
        "rateChange": { "absolute": 0.0072, "relative": 0.0785 },
        "definition": "..."
      }
    }
  },
  "meta": {
    "timezone": "Asia/Ho_Chi_Minh", "now": "2026-10-05T02:00:00.000Z", "today": "2026-10-05",
    "range": { "from": "2026-09-07", "to": "2026-10-04", "partial": false,
               "startUtc": "2026-09-06T17:00:00.000Z", "endUtc": "2026-10-04T17:00:00.000Z" },
    "previousRange": { "from": "2026-08-10", "to": "2026-09-06", ... },
    "definitions": { "sessionsHeld": "...", "activePlayers": "...", "noShows": "...", ... }
  }
}
```

## Decisions

These are the calls made where the brief left room. The metric definitions themselves are in
[docs/metrics.md](docs/metrics.md).

**Stack and setup**

- **PostgreSQL instead of SQLite.** The brief suggests SQLite; the project owner asked for PostgreSQL. The reasons:
  - It is closer to what a production service would run.
  - `timestamptz` and `AT TIME ZONE` make the time zone rules checkable in plain SQL ([docs/spot-check.sql](docs/spot-check.sql)), so they don't depend only on the app code.
  - `CHECK` constraints reject impossible data at the source, such as a cancelled booking with attendance, or a session that ends before it starts.

  The cost is that Docker must be running. Postgres runs from `docker-compose.yml` on host port 5434, so it won't clash with a local Postgres, and `npm start` still does everything in one command.
- **Separate `backend/` and `frontend/`.** The backend is a plain JSON API, so the mobile app can call the same endpoints. The frontend never reads the database.
- **Clean architecture in the backend.** It is a little more ceremony than a small app needs. In return, all metric logic is pure functions with no database, so it is cheap to test and to reuse.
- **Numbers computed in TypeScript rather than SQL.** This keeps one code path for the cards, the chart and the lists (see [Backend layers](#backend-layers)). Plain SQL is kept as an independent check (`npm run db:check`).
- **The CSVs are validated, not trusted.** Bad rows are skipped or corrected and listed with file and line, rather than silently changing the numbers (see [Data](#data)).

**Time**

- **"Now" is configuration.** It is set by `NOW` (default `2026-10-05T09:00:00+07:00`) and reaches the code only through the `Clock` port, so every number is reproducible.
- **Everything is in the club's time zone.** This covers "today", ranges and weeks. A session belongs to the local date it *starts* on. An inclusive local range (7 Sep – 4 Oct) becomes the half-open UTC interval `[6 Sep 17:00Z, 4 Oct 17:00Z)`. The API returns both forms, so clients do no time zone math.
- **Default range and comparison.** The default range is the last 4 complete Monday–Sunday weeks. It is compared with the period of the same length directly before it. A range can be at most 366 days, can't start after today, and is flagged as partial when it reaches today.

**What counts**

- **Sessions held.** A session is held if it was not cancelled and has already started. A session with zero bookings still counts as held.
- **Active players.** A player is active if they have a booking (not cancelled) at a held session that was not marked as a no-show. When attendance wasn't taken, the player is presumed to have played. A player who only no-showed is not active.
- **No-shows.**
  - When no attendance was taken in a period, the count and rate are `null` and the UI shows "Unknown". They are never 0.
  - The rate divides by bookings *with attendance recorded*, and the coverage is shown next to it.
  - Periods are compared by rate in percentage points, because the count rises whenever more attendance is taken.
- **Change when the previous value is 0.** The absolute change is shown, but there is no relative change, rather than "+∞%" or "+100%". The card says there is nothing to compare against.
- **Empty club.** A club that has never held a session gets an explanation page instead of a row of zeros.
- **Drill-down.** Every number opens the exact list it was counted from, built by the same functions.

**Interface**

- **The UI is in English**, matching the brief.
- **All UI state is in the URL,** so any view can be shared.
- **The weekly chart shows one metric at a time**, with the previous period beside it for context. It never uses two y-axes.

**Out of scope**

Authentication, editing data, and anything beyond the four CSVs.

The first two points under "What counts" are assumptions that are easy to change; each one is one line in `domain/metrics/metrics.ts`.

## Next steps

1. **Authentication and per-club access.** A host should see only their own clubs. The API currently trusts the club id in the URL.
2. **Aggregate in SQL once clubs get big.** Keep the TypeScript functions as the reference, and add a test that checks the SQL results against them. Weekly rollups could be precomputed when attendance is saved.
3. **Raise attendance coverage.** The no-show number is only as good as the check-ins behind it. Possible steps: a reminder to take attendance after each session, a one-tap check-in, and showing which sessions still need it (that list already exists).
4. **Frontend tests.** Add component tests for the cards' Unknown and "nothing to compare" states, and a Playwright smoke test of the main flow. Today only the backend is tested.
5. **CI.** Add a GitHub Actions job with a Postgres service that runs `npm run check` and `npm test` on every push.
6. **An OpenAPI spec** for the mobile team, generated from the zod schemas.
7. **Caching.** Responses for past ranges never change, so they can be cached until new attendance is recorded for that period.
8. **More metrics hosts ask for.** New vs returning players, fill rate (bookings ÷ capacity), and the share of late cancellations.
9. **Vietnamese UI**, and date formats that follow each club's locale.
10. **Pagination and CSV export** for the drill-down lists.
