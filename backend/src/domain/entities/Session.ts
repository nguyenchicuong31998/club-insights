export interface Session {
  id: string;
  clubId: string;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  /** False when nobody took attendance: no-shows for this session are unknown, not zero. */
  attendanceRecorded: boolean;
  cancelled: boolean;
}
