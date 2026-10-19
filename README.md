# Club Insights

A dashboard that shows a club host whether more people are playing and who doesn't show up, built on the
nine-month club export in `backend/data/`.

```
backend/    JSON API (Express 5 + TypeScript), also meant for the mobile app
frontend/   Next.js 15 app that reads only from the API
docs/       metric definitions, API reference, how it is built
```

## Run it

You need **Node 22+**, **npm**, and **Docker** (Docker Desktop on Windows and macOS) running. Docker is only
used for PostgreSQL. No `.env` file is needed: the defaults match `docker-compose.yml`.

### Quick start (one command)

```bash
npm start
```

This installs all dependencies, starts PostgreSQL in Docker, creates the tables, loads the CSVs (only if the
database is empty), then runs the API and the dashboard side by side:

| What | URL |
|---|---|
| Dashboard | **http://localhost:3000** |
| API | http://localhost:4000/api/clubs (health check: http://localhost:4000/health) |
| PostgreSQL | `localhost:5434`, user `club`, password `club`, database `club_insights` |

Stop it with `Ctrl+C`. Next time, `npm run dev` does the same without reinstalling. The database keeps running
in Docker until you stop it (see below).

### Step by step

Use this to run each part in its own terminal, or to see what `npm start` does.

**1. Database (Docker Compose)**

```bash
docker compose up -d --wait db     # or: npm run db:up
docker compose ps                  # "db" should show (healthy)
```

Postgres 16 listens on **5434** on your machine (not 5432, so it doesn't clash with a local install). Data
lives in the `pgdata` volume, so it survives restarts.

| Command | Does |
|---|---|
| `docker compose stop` | Stops the database, keeps the data |
| `docker compose down` (`npm run db:down`) | Removes the container, keeps the data |
| `docker compose down -v` | Removes the container **and deletes the data** |
| `npm run db:reset` | Deletes the data, starts again, creates tables, reloads the CSVs |
| `docker compose exec db psql -U club -d club_insights` | Opens a SQL prompt |

**2. Backend (API, port 4000)**

```bash
cd backend
npm install
npm run db:migrate    # creates the tables (safe to run again)
npm run db:seed       # loads backend/data/*.csv, replacing what is there, and lists rejected rows
npm run dev           # http://localhost:4000, restarts on file changes
```

For a production-style run: `npm run build` then `npm start`. Tests: `npm test` (needs the database seeded).

Optional settings: copy `backend/.env.example` to `backend/.env` and change what you need.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | API port |
| `DATABASE_URL` | `postgres://club:club@localhost:5434/club_insights` | Matches `docker-compose.yml` |
| `CORS_ORIGIN` | `http://localhost:3000` | Browser origin allowed to call the API directly (the dashboard calls it from its server, so it doesn't need this) |
| `NOW` | `2026-10-05T09:00:00+07:00` | Fixed "now" for every number, so results are reproducible |

**3. Frontend (dashboard, port 3000)**

Start the backend first, then in a second terminal:

```bash
cd frontend
npm install
npm run dev           # http://localhost:3000
```

For a production-style run: `npm run build` then `npm start`. The page is rendered on the server, which calls
the API at `API_URL` (default `http://localhost:4000`; set it in `frontend/.env.local` if the API runs
elsewhere). The browser never calls the API directly.

### Other commands (from the repo root)

| Command | Does |
|---|---|
| `npm test` | Starts and seeds Postgres if needed, then runs the 70 backend tests |
| `npm run check` | Typechecks backend and frontend, lints the frontend |
| `npm run db:check` | Recomputes the headline numbers in plain SQL, to compare with the screen |
| `npm run db:seed` | Reloads the CSVs, replacing what is in the database, and lists any rejected rows |

The test for the number most likely to be wrong, no-shows, is `backend/test/domain/noShows.test.ts`.

### If something goes wrong

- **`Cannot connect to the Docker daemon` / `db:up` fails:** start Docker Desktop and wait until it says it is
  running, then try again.
- **Port 5434 is already in use:** change the left side of `"5434:5432"` in `docker-compose.yml` and set
  `DATABASE_URL` in `backend/.env` to the same port.
- **Port 3000 is already in use:** run the dashboard on another port with `npm --prefix frontend run dev -- -p 3001`.
- **Port 4000 is already in use:** set `PORT` in `backend/.env` and `API_URL` in `frontend/.env.local` to the
  new port.
- **The dashboard says "Can't reach the API":** the backend isn't running, or `API_URL` points to the wrong
  place.
- **Numbers look wrong or tables are empty:** `npm run db:reset` rebuilds the database from the CSVs.

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

- **PostgreSQL instead of SQLite, on purpose.** The brief asks for SQLite; I chose PostgreSQL because the
  numbers depend on time zones and clean data. What that buys: `timestamptz` and `AT TIME ZONE` let
  `npm run db:check` recompute the headline numbers and the local-week rules in plain SQL, independently of the
  TypeScript, and `CHECK` constraints plus a unique index reject bad rows at the source. What it costs: Docker
  has to be running, and `npm start` starts the database itself. Switching to SQLite would touch only the
  infrastructure layer (repositories, migrations, seed), because all metric and time zone logic is plain
  TypeScript with no database imports.
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
