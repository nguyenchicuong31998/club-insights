-- Reshapes the schema to the real CSV export (backend/data/*.csv), which differs from the sample
-- data 001 was written for:
--   clubs     created_at is a calendar date
--   players   belong to one club and have a join date
--   sessions  have places and a duration (ends_at is derived), and a session-level
--             attendance_recorded flag: attendance is taken for a whole session or not at all
--   bookings  are 'booked' or 'cancelled', with booked_at and cancelled_at
-- The tables only ever hold seed data, so they are emptied; `npm run dev` reloads them.

TRUNCATE bookings, sessions, players, clubs;

ALTER TABLE clubs DROP COLUMN created_at;
ALTER TABLE clubs ADD COLUMN created_on DATE NOT NULL;

ALTER TABLE players DROP COLUMN created_at;
ALTER TABLE players ADD COLUMN club_id TEXT NOT NULL REFERENCES clubs (id);
ALTER TABLE players ADD COLUMN joined_on DATE NOT NULL;
CREATE INDEX players_club_idx ON players (club_id);

-- FALSE: nobody took attendance, so every booking's attendance is unknown (not a no-show).
ALTER TABLE sessions ADD COLUMN attendance_recorded BOOLEAN NOT NULL;

ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE bookings DROP CONSTRAINT bookings_check;
ALTER TABLE bookings RENAME COLUMN created_at TO booked_at;
ALTER TABLE bookings ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('booked', 'cancelled'));
ALTER TABLE bookings ADD CONSTRAINT bookings_cancelled_at_check CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL));
-- A cancelled booking has nothing to attend.
ALTER TABLE bookings ADD CONSTRAINT bookings_attended_check CHECK (status = 'booked' OR attended IS NULL);
-- One live booking per player per session; otherwise a player would be counted twice.
CREATE UNIQUE INDEX bookings_one_live_per_player ON bookings (session_id, player_id) WHERE status = 'booked';
