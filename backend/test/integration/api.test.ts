/**
 * The HTTP API against the seeded Postgres database, checked against the values computed by hand
 * in SQL (docs/metrics.md). Skipped, with a message, when the database is not reachable:
 * run `npm test` from the repo root to start and seed it first.
 */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../../src/config.js";
import { buildApp } from "../../src/container.js";
import { createPool } from "../../src/infrastructure/database/pool.js";
import { NOW } from "../builders.js";

const pool = createPool(config.databaseUrl);
const dbReady = await pool
  // The real export: club-001 with sessions that carry the attendance_recorded flag (migration 002).
  .query("SELECT count(*)::int AS n FROM sessions WHERE club_id = 'club-001' AND attendance_recorded")
  .then((r) => r.rows[0].n > 0)
  .catch(() => false);
if (!dbReady) {
  console.warn(`Skipping API integration tests: no seeded database at ${config.databaseUrl}. Run \`npm test\` from the repo root.`);
  await pool.end();
}

const CLUB = "club-001";
let server: Server;
let base: string;

async function get(path: string) {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
}

type Week = { start: string; sessionsHeld: number; activePlayers: number; partial: string | null; noShows: { count: number | null; recordedBookings: number } };

describe.skipIf(!dbReady)("API on the club export", () => {
  beforeAll(async () => {
    server = buildApp(pool, { now: NOW, corsOrigin: "*" }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  it("lists both clubs, oldest first, with their creation date", async () => {
    const { body } = await get("/clubs");
    expect(body.data.map((c: { id: string; createdOn: string }) => [c.id, c.createdOn])).toEqual([
      ["club-001", "2025-12-01"],
      ["club-002", "2026-10-01"],
    ]);
  });

  it("summary matches the hand-computed values for the last 4 weeks", async () => {
    const { status, body } = await get(`/clubs/${CLUB}/summary`);
    expect(status).toBe(200);
    expect(body.meta.range).toMatchObject({ from: "2026-09-07", to: "2026-10-04", partial: false });
    expect(body.meta.previousRange).toMatchObject({ from: "2026-08-10", to: "2026-09-06" });

    const m = body.data.metrics;
    expect(m.sessionsHeld).toMatchObject({ current: 20, previous: 20 });
    expect(m.activePlayers).toMatchObject({ current: 89, previous: 88 });
    expect(m.noShows.current).toMatchObject({ count: 15, recordedBookings: 151, confirmedBookings: 264 });
    expect(m.noShows.previous).toMatchObject({ count: 14, recordedBookings: 152, confirmedBookings: 248 });
    expect(m.noShows.current.rate).toBeCloseTo(15 / 151, 10);
    expect(m.noShows.previous.rate).toBeCloseTo(14 / 152, 10);
    expect(m.noShows.rateChange.absolute).toBeCloseTo(15 / 151 - 14 / 152, 10);
  });

  it("breaks attendance down by session type, so the rate's coverage is visible", async () => {
    const { body } = await get(`/clubs/${CLUB}/summary`);
    const rows = body.data.metrics.noShows.bySessionType;
    const byTitle = Object.fromEntries(rows.map((r: { title: string; sessionsHeld: number; sessionsWithAttendance: number; noShows: number }) =>
      [r.title, [r.sessionsHeld, r.sessionsWithAttendance, r.noShows]]));
    expect(byTitle).toEqual({
      "Early Bird Monday": [4, 1, 1],
      "Saturday Morning Social": [4, 0, 0],
      "Sunday Ladder": [4, 3, 3],
      "Thursday Drills & Games": [4, 4, 6],
      "Tuesday Open Play": [4, 3, 5],
    });
  });

  it("weekly values match, and the current week is in progress with nothing held yet", async () => {
    const { body } = await get(`/clubs/${CLUB}/weekly?from=2026-08-10&to=2026-10-05`);
    const weeks: Week[] = body.data.weeks;
    expect(weeks.map((w) => w.activePlayers)).toEqual([38, 40, 38, 41, 37, 36, 45, 44, 0]);
    expect(weeks.map((w) => w.noShows.count)).toEqual([1, 3, 4, 6, 2, 5, 6, 2, null]);
    expect(weeks.at(-1)).toMatchObject({ start: "2026-10-05", partial: "in_progress", sessionsHeld: 0 });
  });

  it("weeks are local: 5 and 5 sessions for 7–20 Sep, not the UTC split of 1 / 5 / 4", async () => {
    const { body } = await get(`/clubs/${CLUB}/weekly?from=2026-09-07&to=2026-09-20`);
    expect(body.data.weeks.map((w: Week) => w.sessionsHeld)).toEqual([5, 5]);
  });

  it("weekly values add up to the summary", async () => {
    const { body } = await get(`/clubs/${CLUB}/weekly`);
    const weeks: Week[] = body.data.weeks;
    expect(weeks.reduce((sum, w) => sum + (w.noShows.count ?? 0), 0)).toBe(15);
    expect(weeks.reduce((sum, w) => sum + w.noShows.recordedBookings, 0)).toBe(151);
    expect(weeks.reduce((sum, w) => sum + w.sessionsHeld, 0)).toBe(20);
  });

  it("every headline number equals the list behind it", async () => {
    const [held, active, noShowPlayers, withNoShows, missing] = await Promise.all([
      get(`/clubs/${CLUB}/sessions?filter=held`),
      get(`/clubs/${CLUB}/players?filter=active&pageSize=200`),
      get(`/clubs/${CLUB}/players?filter=no_show&pageSize=200`),
      get(`/clubs/${CLUB}/sessions?filter=with_no_shows&pageSize=200`),
      get(`/clubs/${CLUB}/sessions?filter=attendance_not_recorded&pageSize=200`),
    ]);
    expect(held.body.data.pagination.total).toBe(20);
    expect(active.body.data.pagination.total).toBe(89);
    expect(active.body.data.players).toHaveLength(89);
    const sum = (rows: { noShows: number }[]) => rows.reduce((s, r) => s + r.noShows, 0);
    expect(sum(noShowPlayers.body.data.players)).toBe(15);
    expect(sum(withNoShows.body.data.sessions)).toBe(15);
    // Coverage: 264 bookings, 151 recorded, so 113 sit at sessions without attendance.
    const notRecorded = missing.body.data.sessions.reduce((s: number, r: { notRecorded: number }) => s + r.notRecorded, 0);
    expect(notRecorded).toBe(264 - 151);
  });

  it("pages long lists, and the pages together are exactly the full list", async () => {
    const range = "from=2026-01-05&to=2026-10-04";
    const first = await get(`/clubs/${CLUB}/sessions?${range}&pageSize=50`);
    expect(first.body.data.pagination).toEqual({ page: 1, pageSize: 50, total: 186, totalPages: 4 });
    expect(first.body.data.sessions).toHaveLength(50);
    const ids: string[] = [];
    for (let page = 1; page <= 4; page++) {
      const { body } = await get(`/clubs/${CLUB}/sessions?${range}&pageSize=50&page=${page}`);
      ids.push(...body.data.sessions.map((s: { id: string }) => s.id));
    }
    expect(ids).toHaveLength(186);
    expect(new Set(ids).size).toBe(186);
    // A page past the end shows the last page rather than nothing.
    const past = await get(`/clubs/${CLUB}/sessions?${range}&pageSize=50&page=99`);
    expect(past.body.data.pagination.page).toBe(4);
    expect(past.body.data.sessions).toHaveLength(36);
    expect((await get(`/clubs/${CLUB}/players?pageSize=0`)).status).toBe(400);
    expect((await get(`/clubs/${CLUB}/players?page=abc`)).status).toBe(400);
  });

  it("players with the same name stay separate", async () => {
    const { body } = await get(`/clubs/${CLUB}/players?filter=active&from=2026-01-01&to=2026-10-04&pageSize=200`);
    const ids = body.data.players.map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a session without attendance shows every booking as not recorded, never as a no-show", async () => {
    const { body } = await get(`/clubs/${CLUB}/sessions/s0176`); // Early Bird Monday, 7 Sep 05:30 local
    expect(body.data).toMatchObject({ title: "Early Bird Monday", held: true, attendanceStatus: "not_recorded", cancelledBookings: 1 });
    expect(body.data.bookings).toHaveLength(12);
    expect(new Set(body.data.bookings.map((b: { attendance: string }) => b.attendance))).toEqual(new Set(["not_recorded"]));
  });

  it("a session with attendance labels every booking, and counts cancellations apart", async () => {
    const { body } = await get(`/clubs/${CLUB}/sessions/s0177`);
    const count = (a: string) => body.data.bookings.filter((b: { attendance: string }) => b.attendance === a).length;
    expect(body.data.attendanceStatus).toBe("recorded");
    expect([count("attended"), count("no_show"), count("not_recorded")]).toEqual([10, 1, 0]);
    expect(body.data.cancelledBookings).toBe(1);
  });

  it("the new club has no history and Unknown no-shows, not zeros", async () => {
    const { body } = await get("/clubs/club-002/summary");
    expect(body.data).toMatchObject({ hasHistory: false, firstSessionAt: null, club: { createdOn: "2026-10-01" } });
    expect(body.data.metrics.noShows.current.count).toBeNull();
    expect(body.data.metrics.sessionsHeld).toMatchObject({ current: 0, previous: 0 });
  });

  it("rejects bad input with readable errors", async () => {
    expect((await get(`/clubs/${CLUB}/summary?from=2026-10-04&to=2026-09-07`)).status).toBe(400);
    expect((await get(`/clubs/${CLUB}/summary?from=2026-09-07`)).status).toBe(400);
    expect((await get(`/clubs/${CLUB}/summary?from=2026-02-30&to=2026-03-05`)).status).toBe(400);
    expect((await get(`/clubs/${CLUB}/sessions?filter=bogus`)).status).toBe(400);
    expect((await get(`/clubs/${CLUB}/summary?from=2026-09-07&from=2026-09-08&to=2026-10-04`)).status).toBe(400);
    expect((await get("/clubs/club-002/sessions/s0177")).status).toBe(404); // another club's session
    const missing = await get("/clubs/nope/summary");
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBeTruthy();
  });
});
