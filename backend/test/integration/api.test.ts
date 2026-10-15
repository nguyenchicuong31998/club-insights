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
  .query("SELECT count(*)::int AS n FROM sessions")
  .then((r) => r.rows[0].n > 0)
  .catch(() => false);
if (!dbReady) {
  console.warn(`Skipping API integration tests: no seeded database at ${config.databaseUrl}. Run \`npm test\` from the repo root.`);
  await pool.end();
}

const SAIGON = "clb_saigon";
let server: Server;
let base: string;

async function get(path: string) {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
}

describe.skipIf(!dbReady)("API on the sample data", () => {
  beforeAll(async () => {
    server = buildApp(pool, { now: NOW, corsOrigin: "*" }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  it("summary matches the hand-computed values for the last 4 weeks", async () => {
    const { status, body } = await get(`/clubs/${SAIGON}/summary`);
    expect(status).toBe(200);
    expect(body.meta.range).toMatchObject({ from: "2026-09-07", to: "2026-10-04", partial: false });
    expect(body.meta.previousRange).toMatchObject({ from: "2026-08-10", to: "2026-09-06" });

    const m = body.data.metrics;
    expect(m.sessionsHeld).toMatchObject({ current: 22, previous: 22 });
    expect(m.activePlayers).toMatchObject({ current: 112, previous: 106 });
    expect(m.noShows.current).toMatchObject({ count: 27, recordedBookings: 230, confirmedBookings: 306 });
    expect(m.noShows.previous).toMatchObject({ count: 18, recordedBookings: 191, confirmedBookings: 315 });
    expect(m.noShows.current.rate).toBeCloseTo(0.117, 3);
    expect(m.noShows.previous.rate).toBeCloseTo(0.094, 3);
    expect(m.noShows.rateChange.absolute).toBeCloseTo(0.023, 3);
  });

  it("weekly active players match, with the current week partial", async () => {
    const { body } = await get(`/clubs/${SAIGON}/weekly?from=2026-08-10&to=2026-10-05`);
    const weeks = body.data.weeks;
    expect(weeks.map((w: { activePlayers: number }) => w.activePlayers)).toEqual([57, 52, 56, 47, 60, 52, 59, 52, 11]);
    expect(weeks.at(-1)).toMatchObject({ start: "2026-10-05", partial: "in_progress" });
  });

  it("weeks are local: 6 then 5 sessions for 7–20 Sep, not the UTC split", async () => {
    const { body } = await get(`/clubs/${SAIGON}/weekly?from=2026-09-07&to=2026-09-20`);
    expect(body.data.weeks.map((w: { sessionsHeld: number }) => w.sessionsHeld)).toEqual([6, 5]);
  });

  it("weekly no-shows add up to the summary", async () => {
    const { body } = await get(`/clubs/${SAIGON}/weekly?from=2026-09-07&to=2026-10-04`);
    const total = body.data.weeks.reduce((sum: number, w: { noShows: { count: number | null } }) => sum + (w.noShows.count ?? 0), 0);
    expect(total).toBe(27);
  });

  it("every headline number equals the length of the list behind it", async () => {
    const [held, active, noShowPlayers] = await Promise.all([
      get(`/clubs/${SAIGON}/sessions?filter=held`),
      get(`/clubs/${SAIGON}/players?filter=active`),
      get(`/clubs/${SAIGON}/players?filter=no_show`),
    ]);
    expect(held.body.data.sessions).toHaveLength(22);
    expect(active.body.data.players).toHaveLength(112);
    const noShows = noShowPlayers.body.data.players.reduce((sum: number, p: { noShows: number }) => sum + p.noShows, 0);
    expect(noShows).toBe(27);
  });

  it("the new club has no history and Unknown no-shows, not zeros", async () => {
    const { body } = await get("/clubs/clb_thaodien/summary");
    expect(body.data.hasHistory).toBe(false);
    expect(body.data.metrics.noShows.current.count).toBeNull();
  });

  it("rejects bad input with readable errors", async () => {
    expect((await get(`/clubs/${SAIGON}/summary?from=2026-10-04&to=2026-09-07`)).status).toBe(400);
    expect((await get(`/clubs/${SAIGON}/summary?from=2026-09-07`)).status).toBe(400);
    const missing = await get("/clubs/nope/summary");
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBeTruthy();
  });
});
