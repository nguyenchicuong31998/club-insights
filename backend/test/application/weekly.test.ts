/** Use cases over in-memory repositories: range edges and week buckets are local, end to end. */
import { describe, expect, it } from "vitest";
import { ClubPeriodReader } from "../../src/application/services/ClubPeriodReader.js";
import { GetClubSummary } from "../../src/application/use-cases/GetClubSummary.js";
import { GetWeeklySeries } from "../../src/application/use-cases/GetWeeklySeries.js";
import type { Club } from "../../src/domain/entities/Club.js";
import type { SessionFacts } from "../../src/domain/metrics/SessionFacts.js";
import type { ClubRepository } from "../../src/domain/repositories/ClubRepository.js";
import type { SessionRepository } from "../../src/domain/repositories/SessionRepository.js";
import { FixedClock } from "../../src/infrastructure/clock/FixedClock.js";
import { booking, NOW, session, TZ } from "../builders.js";

const club: Club = { id: "c1", name: "Test Club", timezone: TZ, createdAt: new Date("2026-01-01T00:00:00Z") };

function reader(sessions: SessionFacts[]) {
  const clubs: ClubRepository = {
    findAll: async () => [club],
    findById: async (id) => (id === club.id ? club : null),
  };
  const repo: SessionRepository = {
    // Same contract as the Postgres repository: start in [start, end).
    findStartingBetween: async (_, start, end) => sessions.filter((s) => s.startsAt >= start && s.startsAt < end),
    findDetail: async () => null,
    firstSessionStart: async () =>
      sessions.filter((s) => s.status === "scheduled").map((s) => s.startsAt).sort((a, b) => +a - +b)[0] ?? null,
  };
  return new ClubPeriodReader(clubs, repo, new FixedClock(NOW));
}

const sessions = [
  session("2026-09-13T23:30:00+07:00", [booking("p1", true)]), // Sun: week of 7 Sep
  session("2026-09-14T00:30:00+07:00", [booking("p2", true)]), // Mon 00:30: week of 14 Sep (Sunday in UTC)
  session("2026-09-14T06:00:00+07:00", [booking("p3", false)]), // Mon 06:00: week of 14 Sep (Sunday in UTC)
  session("2026-09-06T23:59:00+07:00", [booking("p4", true)]), // Sun before the range: previous period
  session("2026-10-04T23:30:00+07:00", [booking("p5", null)]), // last evening of the range
  session("2026-10-05T06:00:00+07:00", [booking("p6", true)]), // today, before now: after the range
];

describe("weekly series", () => {
  it("buckets sessions by their local Monday–Sunday week", async () => {
    const { weeks } = await new GetWeeklySeries(reader(sessions)).execute(club.id, {});
    expect(weeks.map((w) => [w.start, w.sessionsHeld])).toEqual([
      ["2026-09-07", 1],
      ["2026-09-14", 2],
      ["2026-09-21", 0],
      ["2026-09-28", 1],
    ]);
  });

  it("keeps Unknown no-shows per week, separate from a known 0", async () => {
    const { weeks } = await new GetWeeklySeries(reader(sessions)).execute(club.id, {});
    expect(weeks.map((w) => w.noShows.count)).toEqual([0, 1, null, null]);
  });

  it("shows the in-progress week as partial", async () => {
    const { weeks } = await new GetWeeklySeries(reader(sessions)).execute(club.id, { from: "2026-09-28", to: "2026-10-05" });
    expect(weeks.map((w) => [w.start, w.partial, w.sessionsHeld])).toEqual([
      ["2026-09-28", null, 1],
      ["2026-10-05", "in_progress", 1],
    ]);
  });
});

describe("summary", () => {
  it("includes both local edges of the range and nothing outside it", async () => {
    const { metrics } = await new GetClubSummary(reader(sessions)).execute(club.id, {});
    expect(metrics.sessionsHeld).toMatchObject({ current: 4, previous: 1 });
    expect(metrics.activePlayers).toMatchObject({ current: 3, previous: 1 }); // p1, p2, p5 (not recorded); p3 no-showed
  });

  it("reports a club with no sessions as having no history, with nothing to compare", async () => {
    const summary = await new GetClubSummary(reader([])).execute(club.id, {});
    expect(summary.hasHistory).toBe(false);
    expect(summary.metrics.sessionsHeld).toMatchObject({ current: 0, previous: 0, change: { relative: null } });
    expect(summary.metrics.noShows.current.count).toBeNull();
    expect(summary.metrics.noShows.rateChange).toBeNull();
  });
});
