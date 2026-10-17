/**
 * Plain-language definitions shown next to each number: short enough to read at a glance.
 * The full rules are in docs/metrics.md. Keep the two in sync.
 */
export const DEFINITIONS = {
  sessionsHeld: "Sessions that started in this period and weren't cancelled.",
  activePlayers:
    "Different people with a booking at a session held in this period. " +
    "A booking marked no-show doesn't count; one where attendance wasn't taken does.",
  noShows:
    "Bookings marked absent, at sessions where attendance was taken. " +
    "Rate = no-shows ÷ bookings that were checked.",
  previousPeriod: "The same number of days, straight before the selected range.",
  weeks: "Weeks run Monday to Sunday in the club's time zone.",
} as const;

export type MetricKey = "sessionsHeld" | "activePlayers" | "noShows";
