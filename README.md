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
npm run install:all   # root, backend and frontend dependencies
cp backend/.env.example backend/.env
npm run dev           # starts Postgres, the API on :4000 and the web app on :3000
```

The schema in `backend/db/schema.sql` is applied automatically the first time the
Postgres container starts. To re-apply it after editing, run `npm run db:down -- -v`, which also deletes the data volume.

## Backend layers

Dependencies point inward only: `interfaces → application → domain`, with
`infrastructure` implementing interfaces that `domain` declares.

| Layer | Folder | Holds |
|---|---|---|
| Domain | `src/domain` | Entities (`Club`, `Player`, `Session`, `Booking`) and repository interfaces. No framework or DB imports. |
| Application | `src/application` | Use cases (`ListClubs`, `GetClub`) and application errors. Depend on repository interfaces only. |
| Infrastructure | `src/infrastructure` | `pg` pool and `Pg*Repository` classes that implement the domain interfaces. |
| Interfaces | `src/interfaces/http` | Express app, routes, controllers, error → HTTP status mapping. |
| Composition root | `src/main.ts` | The only file that wires concrete classes together. |

To add a feature: entity/interface in `domain` → use case in `application` →
Postgres implementation in `infrastructure` → controller + route in `interfaces` → wire in `main.ts`.

## API

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }` |
| GET | `/api/clubs` | `{ "data": Club[] }` |
| GET | `/api/clubs/:id` | `{ "data": Club }` or 404 |

## Status

- The CSV files (`clubs`, `players`, `sessions`, `bookings`) are not in the repo yet, so the
  schema columns are provisional and there is no seed script.
- The brief asks for SQLite. This scaffold uses PostgreSQL by request; the README should say why before submission.
