import type { SessionStatus } from "../entities/Session.js";

/** A live booking (status booked; "confirmed" in the API) as the metrics see it. Cancelled bookings never reach the metrics. */
export interface BookingFact {
  bookingId: string;
  playerId: string;
  playerName: string;
  /** true = attended, false = no-show, null = attendance not recorded (unknown), including every booking at a session with attendance_recorded = false. */
  attended: boolean | null;
}

/** A session together with its confirmed bookings: the only input every metric is computed from. */
export interface SessionFacts {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: SessionStatus;
  bookings: BookingFact[];
}
