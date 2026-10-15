/**
 * No-shows are the number most likely to be wrong: attendance is often not taken, and the easy
 * mistakes are treating "not recorded" as "attended" (a false 0) or dividing by all bookings
 * (a rate that is too low). See docs/metrics.md.
 */
import { describe, expect, it } from "vitest";
import { change, computePeriodMetrics, playersBehind, sessionsBehind } from "../../src/domain/metrics/metrics.js";
import { booking, bookings, NOW, session } from "../builders.js";

describe("no-shows when attendance was not taken", () => {
  it("is Unknown (null), not 0, when no session in the period has attendance", () => {
    const m = computePeriodMetrics(
      [
        session("2026-09-14T18:00:00+07:00", bookings("a", 8, null)),
        session("2026-09-16T18:00:00+07:00", bookings("b", 6, null)),
      ],
      NOW,
    ).noShows;

    expect(m.count).toBeNull();
    expect(m.rate).toBeNull();
    expect(m).toMatchObject({ recordedBookings: 0, confirmedBookings: 14, sessionsWithAttendance: 0 });
  });

  it("is Unknown when held sessions had no bookings at all", () => {
    const m = computePeriodMetrics([session("2026-09-14T18:00:00+07:00", [])], NOW);
    expect(m.sessionsHeld).toBe(1);
    expect(m.noShows.count).toBeNull();
  });

  it("is a real 0 when attendance was taken and everyone came", () => {
    const m = computePeriodMetrics([session("2026-09-14T18:00:00+07:00", bookings("a", 5, true))], NOW).noShows;
    expect(m.count).toBe(0);
    expect(m.rate).toBe(0);
  });
});

describe("no-shows when attendance was taken for only some bookings", () => {
  // Session A: attendance taken, 8 bookings, 2 no-shows.
  // Session B: attendance not taken, 10 bookings.
  // Session C: taken for 3 of 4 bookings, 1 no-show.
  const sessions = [
    session("2026-09-14T18:00:00+07:00", [...bookings("a", 6, true), ...bookings("x", 2, false)]),
    session("2026-09-15T18:00:00+07:00", bookings("b", 10, null)),
    session("2026-09-16T18:00:00+07:00", [booking("c1", true), booking("c2", true), booking("c3", false), booking("c4", null)]),
  ];
  const m = computePeriodMetrics(sessions, NOW).noShows;

  it("counts only bookings marked as did-not-attend", () => {
    expect(m.count).toBe(3);
  });

  it("divides by bookings with attendance recorded, not by all bookings", () => {
    // 3 / 11 recorded = 27.3%. Dividing by all 22 bookings would give a misleading 13.6%.
    expect(m.rate).toBeCloseTo(3 / 11, 10);
    expect(m.rate).not.toBeCloseTo(3 / 22, 3);
  });

  it("reports coverage so the rate can be read in context", () => {
    expect(m).toMatchObject({ recordedBookings: 11, confirmedBookings: 22, sessionsWithAttendance: 2 });
  });

  it("matches the drill-down lists behind it", () => {
    const withNoShows = sessionsBehind(sessions, NOW, "with_no_shows");
    const noShowPlayers = playersBehind(sessions, NOW, "no_show");
    expect(withNoShows.reduce((sum, s) => sum + s.noShows, 0)).toBe(m.count);
    expect(noShowPlayers.reduce((sum, p) => sum + p.noShows, 0)).toBe(m.count);
    expect(sessionsBehind(sessions, NOW, "attendance_not_recorded").map((s) => s.attendanceStatus))
      .toEqual(["partly_recorded", "not_recorded"]);
  });
});

describe("what never counts towards no-shows", () => {
  it("ignores cancelled sessions and sessions that have not started yet", () => {
    const m = computePeriodMetrics(
      [
        session("2026-09-14T18:00:00+07:00", [booking("a", true), booking("b", false)]),
        session("2026-09-02T18:00:00+07:00", [booking("c", false)], { status: "cancelled" }),
        // Starts at 18:00 on "today", after now (09:00): not held yet.
        session("2026-10-05T18:00:00+07:00", [booking("d", false)]),
      ],
      NOW,
    );
    expect(m.sessionsHeld).toBe(1);
    expect(m.noShows).toMatchObject({ count: 1, recordedBookings: 2, confirmedBookings: 2 });
  });
});

describe("comparing no-shows with the previous period", () => {
  it("has no change when either period is Unknown", () => {
    expect(change(0.12, null)).toBeNull();
    expect(change(null, 0.1)).toBeNull();
  });

  it("compares rates in points, so more coverage alone is not read as more no-shows", () => {
    // Previous: 18 of 191 recorded. Current: 27 of 230 recorded (the sample data).
    const c = change(27 / 230, 18 / 191)!;
    expect(c.absolute).toBeCloseTo(0.023, 3); // +2.3 points, while the count rose 50%.
  });
});

describe("active players and no-shows", () => {
  const sessions = [
    session("2026-09-14T18:00:00+07:00", [booking("p1", true), booking("p2", false), booking("p3", null)]),
    session("2026-09-16T18:00:00+07:00", [booking("p1", true), booking("p4", false)]),
    session("2026-09-18T18:00:00+07:00", [booking("p4", true)]),
  ];

  it("counts each player once; a player who only no-showed is not active, unrecorded is", () => {
    // p1 attended twice, p3 not recorded, p4 no-showed once and attended once. p2 only no-showed.
    expect(computePeriodMetrics(sessions, NOW).activePlayers).toBe(3);
    expect(playersBehind(sessions, NOW, "active").map((p) => p.id).sort()).toEqual(["p1", "p3", "p4"]);
  });
});
