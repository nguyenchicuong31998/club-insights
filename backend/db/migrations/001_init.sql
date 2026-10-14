-- Initial schema, matching the columns of backend/data/*.csv.
-- Timestamps are stored in UTC (timestamptz); each club carries its own IANA time zone,
-- and weeks/date ranges are computed in that zone at query time.
-- Applied by src/cli/migrate.ts. Once shipped, change the schema with a new numbered file.

CREATE TABLE clubs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  timezone   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

-- Players are not scoped to a club: the same person can book at several clubs.
CREATE TABLE players (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sessions (
  id        TEXT PRIMARY KEY,
  club_id   TEXT NOT NULL REFERENCES clubs (id),
  title     TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at   TIMESTAMPTZ NOT NULL,
  capacity  INTEGER NOT NULL CHECK (capacity > 0),
  status    TEXT NOT NULL CHECK (status IN ('scheduled', 'cancelled')),
  CHECK (ends_at > starts_at)
);
CREATE INDEX sessions_club_starts_idx ON sessions (club_id, starts_at);

CREATE TABLE bookings (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions (id),
  player_id  TEXT NOT NULL REFERENCES players (id),
  status     TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  -- TRUE = showed up, FALSE = no-show, NULL = attendance not recorded (unknown, NOT a no-show).
  attended   BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL,
  -- A cancelled booking has nothing to attend.
  CHECK (status = 'confirmed' OR attended IS NULL)
);
CREATE INDEX bookings_session_idx ON bookings (session_id);
CREATE INDEX bookings_player_idx ON bookings (player_id);
