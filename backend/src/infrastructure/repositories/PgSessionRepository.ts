import type pg from "pg";
import type { BookingFact, SessionFacts } from "../../domain/metrics/SessionFacts.js";
import type { SessionDetail, SessionRepository } from "../../domain/repositories/SessionRepository.js";

interface SessionRow {
  id: string;
  club_id: string;
  title: string;
  starts_at: Date;
  ends_at: Date;
  capacity: number;
  status: "scheduled" | "cancelled";
  cancelled_bookings: number;
  /** Built by json_agg, so pg already parsed it. */
  bookings: BookingFact[];
}

// Sessions with their live (booked) bookings in one round trip. Cancelled bookings are only counted.
// Attendance is taken per session: when attendance_recorded is false every booking's attendance is
// unknown (NULL), whatever the attended column says.
const SELECT_SESSIONS = `
  SELECT s.id, s.club_id, s.title, s.starts_at, s.ends_at, s.capacity, s.status,
         count(b.id) FILTER (WHERE b.status = 'cancelled')::int AS cancelled_bookings,
         COALESCE(
           json_agg(json_build_object(
             'bookingId', b.id, 'playerId', p.id, 'playerName', p.name,
             'attended', CASE WHEN s.attendance_recorded THEN b.attended END
           ) ORDER BY p.name, p.id) FILTER (WHERE b.status = 'booked'),
           '[]'
         ) AS bookings
  FROM sessions s
  LEFT JOIN bookings b ON b.session_id = s.id
  LEFT JOIN players p ON p.id = b.player_id`;

const toFacts = (row: SessionRow): SessionFacts => ({
  id: row.id,
  title: row.title,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  capacity: row.capacity,
  status: row.status,
  bookings: row.bookings,
});

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findStartingBetween(clubId: string, start: Date, end: Date): Promise<SessionFacts[]> {
    const { rows } = await this.pool.query<SessionRow>(
      `${SELECT_SESSIONS}
       WHERE s.club_id = $1 AND s.starts_at >= $2 AND s.starts_at < $3
       GROUP BY s.id
       ORDER BY s.starts_at`,
      [clubId, start, end],
    );
    return rows.map(toFacts);
  }

  async findDetail(clubId: string, sessionId: string): Promise<SessionDetail | null> {
    const { rows } = await this.pool.query<SessionRow>(
      `${SELECT_SESSIONS}
       WHERE s.club_id = $1 AND s.id = $2
       GROUP BY s.id`,
      [clubId, sessionId],
    );
    const row = rows[0];
    return row ? { ...toFacts(row), clubId: row.club_id, cancelledBookings: row.cancelled_bookings } : null;
  }

  async firstSessionStart(clubId: string): Promise<Date | null> {
    const { rows } = await this.pool.query<{ first: Date | null }>(
      "SELECT min(starts_at) AS first FROM sessions WHERE club_id = $1 AND status = 'scheduled'",
      [clubId],
    );
    return rows[0].first;
  }
}
