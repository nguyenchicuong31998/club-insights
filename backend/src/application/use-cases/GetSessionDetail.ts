import { attendanceStatus, isHeld, type AttendanceStatus } from "../../domain/metrics/metrics.js";
import type { SessionDetail } from "../../domain/repositories/SessionRepository.js";
import type { SessionRepository } from "../../domain/repositories/SessionRepository.js";
import { NotFoundError } from "../errors.js";
import type { Clock } from "../ports/Clock.js";

/** Explicit label so clients (web, mobile) never have to interpret true/false/null themselves. */
export type BookingAttendance = "attended" | "no_show" | "not_recorded";

export interface SessionDetailView extends Omit<SessionDetail, "bookings"> {
  held: boolean;
  attendanceStatus: AttendanceStatus;
  bookings: { bookingId: string; playerId: string; playerName: string; attendance: BookingAttendance }[];
}

export class GetSessionDetail {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(clubId: string, sessionId: string): Promise<SessionDetailView> {
    const session = await this.sessions.findDetail(clubId, sessionId);
    if (!session) throw new NotFoundError("Session", sessionId);
    return {
      ...session,
      held: isHeld(session, this.clock.now()),
      attendanceStatus: attendanceStatus(session),
      bookings: session.bookings.map(({ attended, ...b }) => ({
        ...b,
        attendance: attended === true ? "attended" : attended === false ? "no_show" : "not_recorded",
      })),
    };
  }
}
