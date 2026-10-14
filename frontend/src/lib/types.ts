// Shapes returned by the backend API (see README "API"). Timestamps arrive as ISO strings in UTC.

export interface Club {
  id: string;
  name: string;
  timezone: string;
  createdAt: string;
}

export interface Range {
  from: string;
  to: string;
  startUtc: string;
  endUtc: string;
}

export interface Meta {
  clubId: string;
  timezone: string;
  now: string;
  today: string;
  range: Range & { partial: boolean };
  previousRange: Range;
  definitions: Record<"sessionsHeld" | "activePlayers" | "noShows" | "previousPeriod" | "weeks", string>;
}

export interface Change {
  absolute: number;
  relative: number | null;
}

export interface CountComparison {
  current: number;
  previous: number;
  change: Change | null;
  definition: string;
}

export interface NoShowMetric {
  count: number | null;
  rate: number | null;
  recordedBookings: number;
  confirmedBookings: number;
  sessionsWithAttendance: number;
}

export interface Summary {
  club: Club;
  firstSessionAt: string | null;
  hasHistory: boolean;
  metrics: {
    sessionsHeld: CountComparison;
    activePlayers: CountComparison;
    noShows: { current: NoShowMetric; previous: NoShowMetric; rateChange: Change | null; definition: string };
  };
}

export interface WeeklyPoint {
  start: string;
  end: string;
  partial: "starts_before_range" | "ends_after_range" | "in_progress" | null;
  sessionsHeld: number;
  activePlayers: number;
  noShows: NoShowMetric;
}

export interface Weekly {
  definition: string;
  weeks: WeeklyPoint[];
}

export type AttendanceStatus = "recorded" | "partly_recorded" | "not_recorded" | "no_bookings";

export interface SessionRow {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  confirmedBookings: number;
  attended: number;
  noShows: number;
  notRecorded: number;
  attendanceStatus: AttendanceStatus;
}

export interface PlayerRow {
  id: string;
  name: string;
  sessionsPlayed: number;
  attended: number;
  noShows: number;
  notRecorded: number;
  lastSessionAt: string;
}

export type SessionFilter = "held" | "with_no_shows" | "attendance_not_recorded";
export type PlayerFilter = "active" | "no_show";

export interface SessionDetail {
  id: string;
  clubId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: "scheduled" | "cancelled";
  held: boolean;
  attendanceStatus: AttendanceStatus;
  cancelledBookings: number;
  bookings: { bookingId: string; playerId: string; playerName: string; attendance: "attended" | "no_show" | "not_recorded" }[];
}
