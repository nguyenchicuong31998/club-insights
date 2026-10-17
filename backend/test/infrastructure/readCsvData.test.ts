/** The CSV loader: what gets in decides every number, so bad rows must be caught, not absorbed. */
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readCsvData } from "../../src/infrastructure/seed/readCsvData.js";

const CLUBS = `club_id,name,time_zone,created_at
c1,Club One,Asia/Ho_Chi_Minh,2025-12-01
c2,Club Two,Asia/Ho_Chi_Minh,2026-10-01`;
const PLAYERS = `player_id,club_id,name,joined_club_at
p1,c1,An,2025-12-03
p2,c1,Bình,2025-12-04
p3,c2,Chi,2026-10-02`;
const SESSIONS_HEADER = "session_id,club_id,title,starts_at,duration_minutes,places,status,attendance_recorded";
const BOOKINGS_HEADER = "booking_id,session_id,player_id,booked_at,status,cancelled_at,attended";

async function load(files: { sessions: string[]; bookings: string[]; clubs?: string; players?: string }) {
  const dir = await mkdtemp(join(tmpdir(), "club-csv-"));
  await writeFile(join(dir, "clubs.csv"), files.clubs ?? CLUBS);
  await writeFile(join(dir, "players.csv"), files.players ?? PLAYERS);
  await writeFile(join(dir, "sessions.csv"), [SESSIONS_HEADER, ...files.sessions].join("\n"));
  await writeFile(join(dir, "bookings.csv"), [BOOKINGS_HEADER, ...files.bookings].join("\n"));
  return readCsvData(dir);
}

const S1 = "s1,c1,Open Play,2026-09-06T22:30:00Z,90,12,scheduled,true";
const S2_UNRECORDED = "s2,c1,Social,2026-09-12T00:00:00Z,120,16,scheduled,false";

describe("reading the club export", () => {
  it("maps columns, derives the end time, and keeps blank attendance as unknown", async () => {
    const { data, rejected, adjusted } = await load({
      sessions: [S1, S2_UNRECORDED],
      bookings: [
        "b1,s1,p1,2026-09-01T10:00:00Z,booked,,true",
        "b2,s1,p2,2026-09-01T10:00:00Z,booked,,false",
        "b3,s2,p1,2026-09-01T10:00:00Z,booked,,",
      ],
    });
    expect(rejected).toEqual([]);
    expect(adjusted).toEqual([]);
    expect(data.clubs[0]).toEqual({ id: "c1", name: "Club One", timezone: "Asia/Ho_Chi_Minh", createdOn: "2025-12-01" });
    expect(data.sessions[0]).toMatchObject({ capacity: 12, endsAt: "2026-09-07T00:00:00.000Z", attendanceRecorded: true });
    expect(data.bookings.map((b) => b.attended)).toEqual([true, false, null]);
  });

  it.each([
    ["2026-02-30T10:00:00Z", "a day that does not exist (Date.parse would roll it to 2 March)"],
    ["2026-09-07T24:00:00Z", "hour 24"],
    ["2026-09-07T10:00:00", "no offset, so the instant is ambiguous"],
    ["7/9/2026 10:00", "not ISO-8601"],
  ])("rejects starts_at %s: %s", async (startsAt) => {
    const { data, rejected } = await load({ sessions: [`s1,c1,Open Play,${startsAt},90,12,scheduled,true`], bookings: [] });
    expect(data.sessions).toEqual([]);
    expect(rejected[0]).toMatchObject({ file: "sessions.csv", line: 2 });
    expect(rejected[0].reason).toContain("starts_at");
  });

  it("rejects bad numbers and flags", async () => {
    const { rejected } = await load({
      sessions: [
        "s1,c1,A,2026-09-06T22:30:00Z,0,12,scheduled,true",
        "s2,c1,B,2026-09-06T22:30:00Z,90,1.5,scheduled,true",
        "s3,c1,C,2026-09-06T22:30:00Z,90,12,postponed,true",
        "s4,c1,D,2026-09-06T22:30:00Z,90,12,scheduled,",
        "s5,c9,E,2026-09-06T22:30:00Z,90,12,scheduled,true",
      ],
      bookings: [],
    });
    expect(rejected.map((r) => r.reason)).toEqual([
      'duration_minutes "0" is not a positive whole number',
      'places "1.5" is not a positive whole number',
      'status "postponed" is not one of scheduled|cancelled',
      "attendance_recorded is empty",
      "unknown club_id c9",
    ]);
  });

  it("rejects a second live booking by the same player, but allows cancel then rebook", async () => {
    const { data, rejected } = await load({
      sessions: [S1],
      bookings: [
        "b1,s1,p1,2026-09-01T10:00:00Z,cancelled,2026-09-02T10:00:00Z,",
        "b2,s1,p1,2026-09-03T10:00:00Z,booked,,true",
        "b3,s1,p1,2026-09-04T10:00:00Z,booked,,true",
      ],
    });
    expect(data.bookings.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(rejected).toEqual([{ file: "bookings.csv", line: 4, reason: "player p1 already has a booking for s1" }]);
  });

  it("rejects a booking by a player from another club", async () => {
    const { rejected } = await load({ sessions: [S1], bookings: ["b1,s1,p3,2026-09-01T10:00:00Z,booked,,true"] });
    expect(rejected[0].reason).toBe("player p3 is not a member of c1");
  });

  it("rejects inconsistent cancellations", async () => {
    const { data, rejected } = await load({
      sessions: [S1],
      bookings: [
        "b1,s1,p1,2026-09-01T10:00:00Z,cancelled,,",
        "b2,s1,p2,2026-09-01T10:00:00Z,cancelled,2026-09-02T10:00:00Z,false",
        "b3,s1,p2,2026-09-01T10:00:00Z,booked,2026-09-02T10:00:00Z,true",
      ],
    });
    expect(data.bookings).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual([
      "cancelled booking has no cancelled_at",
      "cancelled booking has attendance recorded",
      "booking has cancelled_at but status booked",
    ]);
  });

  it("ignores attendance on a session that did not record it, and says so", async () => {
    const { data, adjusted } = await load({ sessions: [S2_UNRECORDED], bookings: ["b1,s2,p1,2026-09-01T10:00:00Z,booked,,false"] });
    expect(data.bookings[0].attended).toBeNull();
    expect(adjusted[0]).toMatchObject({ file: "bookings.csv", line: 2 });
  });

  it("rejects children of a rejected row, so foreign keys stay consistent", async () => {
    const { data, rejected } = await load({
      sessions: ["s1,c1,Open Play,2026-02-30T10:00:00Z,90,12,scheduled,true"],
      bookings: ["b1,s1,p1,2026-02-20T10:00:00Z,booked,,true"],
    });
    expect(data.bookings).toEqual([]);
    expect(rejected.map((r) => r.reason)).toContain("unknown session_id s1");
  });

  it("rejects an unknown time zone and an impossible date", async () => {
    const { rejected } = await load({
      clubs: "club_id,name,time_zone,created_at\nc1,Club One,Asia/Saigon_City,2025-12-01\nc2,Club Two,UTC,2026-02-29",
      players: "player_id,club_id,name,joined_club_at",
      sessions: [],
      bookings: [],
    });
    expect(rejected.map((r) => r.reason)).toEqual([
      'time_zone "Asia/Saigon_City" is not an IANA time zone',
      'created_at "2026-02-29" is not a date as YYYY-MM-DD',
    ]);
  });

  it("loads the real export in backend/data without a single rejected or corrected row", async () => {
    const { data, csvRows, rejected, adjusted } = await readCsvData(fileURLToPath(new URL("../../data", import.meta.url)));
    expect(csvRows).toEqual({ clubs: 2, players: 260, sessions: 195, bookings: 1893 });
    expect([rejected, adjusted]).toEqual([[], []]);
    expect(data.sessions.filter((s) => s.attendanceRecorded)).toHaveLength(104);
  });
});
