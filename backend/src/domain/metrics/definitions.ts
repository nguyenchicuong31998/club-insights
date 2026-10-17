/** Plain-language definitions shown next to each number. Keep in sync with docs/metrics.md. */
export const DEFINITIONS = {
  sessionsHeld: "Sessions that started in this period and were not cancelled.",
  activePlayers:
    "Different players with at least one booking (not cancelled) at a session held in this period, " +
    "not counting bookings marked as no-show. Players at sessions without attendance are counted.",
  noShows:
    "Bookings marked as did-not-attend at held sessions. Only sessions where attendance " +
    "was taken can have no-shows, so the rate is no-shows ÷ bookings with attendance recorded.",
  previousPeriod: "The same number of days immediately before the selected range.",
  weeks: "Weeks run Monday to Sunday in the club's time zone.",
} as const;

export type MetricKey = "sessionsHeld" | "activePlayers" | "noShows";
