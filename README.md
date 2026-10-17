# Club Insights

A dashboard that shows a club host whether more people are playing and who doesn't show up, built on the
nine-month club export in `backend/data/`.

```
backend/    JSON API (Express 5 + TypeScript), also meant for the mobile app
frontend/   Next.js 15 app that reads only from the API
docs/       metric definitions, API reference, how it is built
```

## Run it

Needs **Node 22+** and **Docker Desktop running** (for PostgreSQL; see the first decision below).

```bash
npm start
```

This installs dependencies, starts Postgres on port 5434, creates the tables, loads the CSVs, and serves the
API on http://localhost:4000 and the dashboard on **http://localhost:3000**. Afterwards, `npm run dev` skips
the install. No `.env` is needed.

| Command | Does |
|---|---|
| `npm test` | Starts and seeds Postgres if needed, then runs the 67 backend tests |
| `npm run check` | Typechecks backend and frontend, lints the frontend |
| `npm run db:check` | Recomputes the headline numbers in plain SQL, to compare with the screen |
| `npm run db:seed` / `db:reset` | Reloads the CSVs (lists any rejected rows) / rebuilds the database from scratch |

The test for the number most likely to be wrong, no-shows, is `backend/test/domain/noShows.test.ts`.

## Decisions where the brief was silent

**The numbers** (full rules and hand-checked expected values: [docs/metrics.md](docs/metrics.md))

- **Sessions held:** not cancelled and already started. A session nobody booked still counts as held.
- **Active players:** different people with a booking at a held session, minus bookings marked no-show.
  A player at a session without attendance *counts*: 91 of 186 sessions never took attendance, and leaving
  those players out would hide half the club.
- **No-shows:** only where attendance was taken (the export flags this per session). With no attendance in a
  period the value is *Unknown*, never 0. The rate is no-shows ÷ bookings that were checked, and periods are
  compared by **rate**, because the count rises whenever more attendance is taken. The share of sessions that
  took attendance is always shown next to it, and broken down per recurring session, because coverage is very
  uneven: Thursday Drills took attendance 34 times out of 36, Saturday Social 6 out of 36.
- **Comparison:** the same number of days straight before the range. Default range: the last 4 complete
  Monday–Sunday weeks (7 Sep – 4 Oct, against 10 Aug – 6 Sep). When the previous value is 0, no percentage is
  invented. A range that reaches today is flagged as not over yet.
- **Time:** every date, range and week is in the club's time zone. A session belongs to the local day it
  starts: *Early Bird Monday* at 05:30 is still Sunday in UTC, and UTC weeks would put it in the wrong week.
  "Now" is configuration (`NOW`), read through a `Clock` port, so the numbers are reproducible.
- **New club:** no zeros. The page explains what will appear and when, and the habits that make the numbers
  trustworthy from the first week.

**The build**

- **PostgreSQL instead of SQLite.** The brief asks for SQLite; this project uses PostgreSQL at the owner's
  request. What that buys: `CHECK` constraints and a unique index reject bad data at the source, and
  `timestamptz` / `AT TIME ZONE` let `npm run db:check` verify the time zone rules in plain SQL. What it costs:
  Docker has to be running. Switching back would touch only the infrastructure layer (repositories,
  migrations, seed), because all metric and time zone logic is plain TypeScript.
- **Numbers are computed in one place.** The domain layer computes every number from "sessions with their
  bookings", and the cards, the chart and the drill-down lists all call the same functions. So a headline
  number always equals the list behind it, and the logic is tested without a database.
- **The CSVs are validated, not trusted.** Impossible dates, duplicate bookings, players from another club and
  inconsistent cancellations are rejected, and each one is reported with file and line.
- **The API is built for the mobile app:** it returns definitions, local dates and UTC instants, and explicit
  labels (`attended` / `no_show` / `not_recorded`), so no client has to redo time zone or null logic. Lists
  are paged, and each page reports the total, which always equals the number it is behind.
  Reference: [docs/api.md](docs/api.md).
- **UI in English**, matching the brief. All state is in the URL, so any view can be shared.

How it is built (data, layers, tests, screens): [docs/architecture.md](docs/architecture.md).

## What I would do next

1. **Raise attendance coverage.** The no-show number is only as good as the check-ins behind it: a reminder
   after each session, a one-tap check-in, and a list of sessions still missing attendance (the API has it).
2. **Authentication and per-club access.** The API currently trusts the club id in the URL.
3. **Frontend tests and CI.** Add component tests for the Unknown and "nothing to compare" states, a Playwright
   smoke test, and a GitHub Actions job running `npm run check` and `npm test` against Postgres.
4. **Aggregate in SQL as clubs grow,** with the TypeScript functions kept as the reference in tests.
5. **More host questions:** new vs returning players, fill rate, late cancellations, repeat no-shows.
6. **Vietnamese UI** and locale-aware dates; an OpenAPI spec for the mobile team.
