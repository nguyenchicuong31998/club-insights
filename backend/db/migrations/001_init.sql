-- Initial schema. Column names are provisional until the real CSV files arrive.
-- Timestamps are stored in UTC (timestamptz); each club carries its own IANA time zone.
-- Applied by src/cli/migrate.ts; never edit an applied migration, add a new numbered file instead.

CREATE TABLE IF NOT EXISTS clubs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  timezone   TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id                  TEXT PRIMARY KEY,
  club_id             TEXT NOT NULL REFERENCES clubs(id),
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ,
  capacity            INTEGER,
  attendance_recorded BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled           BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS sessions_club_starts_idx ON sessions (club_id, starts_at);

CREATE TABLE IF NOT EXISTS bookings (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  player_id  TEXT NOT NULL REFERENCES players(id),
  status     TEXT NOT NULL,          -- e.g. confirmed | cancelled
  attended   BOOLEAN,                -- NULL = attendance not recorded (unknown, not a no-show)
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_session_idx ON bookings (session_id);
CREATE INDEX IF NOT EXISTS bookings_player_idx ON bookings (player_id);
