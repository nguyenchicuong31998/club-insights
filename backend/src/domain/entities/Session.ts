export type SessionStatus = "scheduled" | "cancelled";

export interface Session {
  id: string;
  clubId: string;
  title: string;
  startsAt: Date;
  /** startsAt + duration. */
  endsAt: Date;
  /** Places. */
  capacity: number;
  status: SessionStatus;
  /** False: nobody took attendance, so every booking's attendance is unknown. */
  attendanceRecorded: boolean;
}
