/**
 * Writes the sample CSVs in backend/data. The output is deterministic (fixed PRNG seed),
 * so re-running it reproduces the committed files byte for byte.
 *
 * The data is shaped to exercise the cases the dashboard must get right:
 *  - all timestamps are UTC; sessions are scheduled in Asia/Ho_Chi_Minh (UTC+7), and the
 *    Monday 06:00 session starts on Sunday in UTC (week-boundary trap);
 *  - attendance was not taken before June, on some sessions after that, and never yet on
 *    sessions after "now" (Mon 5 Oct 2026 09:00 local) — those no-shows are unknown;
 *  - a few sessions record attendance for only part of their bookings;
 *  - cancelled sessions, cancelled bookings, and players who cancel then rebook;
 *  - a second club created this week with no sessions at all.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const OUT_DIR = fileURLToPath(new URL("../../data/", import.meta.url));
const TZ_OFFSET_HOURS = 7; // Asia/Ho_Chi_Minh has no DST
const NOW = localToUtc(2026, 10, 5, 9, 0);
const FIRST_WEEK = localToUtc(2026, 4, 6, 0, 0); // Monday
const WEEKS = 28; // through Sun 18 Oct 2026, two weeks past "now"
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// mulberry32: small, seedable PRNG so the CSVs are reproducible.
let state = 20261005;
function rand(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chance = (p: number) => rand() < p;
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];

function localToUtc(y: number, m: number, d: number, h: number, min: number): Date {
  return new Date(Date.UTC(y, m - 1, d, h - TZ_OFFSET_HOURS, min));
}
const iso = (d: Date) => d.toISOString().replace(".000Z", "Z");

function csv(header: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

// ---- clubs ---------------------------------------------------------------
const MAIN_CLUB = "clb_saigon";
const NEW_CLUB = "clb_thaodien";
const clubs = [
  [MAIN_CLUB, "Saigon Pickleball Club", "Asia/Ho_Chi_Minh", iso(localToUtc(2026, 3, 28, 10, 0))],
  [NEW_CLUB, "Thao Dien Pickleball", "Asia/Ho_Chi_Minh", iso(localToUtc(2026, 10, 5, 8, 15))],
];

// ---- players -------------------------------------------------------------
const FAMILY = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Vu", "Vo", "Dang", "Bui", "Do", "Ho", "Ngo", "Duong", "Ly"];
const GIVEN = ["An", "Binh", "Chau", "Dung", "Giang", "Hai", "Hanh", "Hieu", "Hoa", "Huy", "Khanh", "Lan", "Linh",
  "Long", "Mai", "Minh", "My", "Nam", "Ngoc", "Phuong", "Quan", "Quynh", "Son", "Tam", "Thao", "Trang", "Tuan", "Vy"];
const EXPATS = ["Alex Turner", "Sophie Martin", "Daniel Kim", "Emma Wilson", "Lucas Meyer", "Chloe Dubois",
  "Ryan O'Brien", "Hana Sato", "Marco Rossi", "Olivia Chen", "Jake Morris", "Priya Shah"];

interface PlayerSeed { id: string; name: string; joinsAt: Date; frequency: number }
const players: PlayerSeed[] = [];
const usedNames = new Set<string>();
for (let i = 1; i <= 150; i++) {
  let name: string;
  do {
    name = i % 12 === 0 ? pick(EXPATS) : `${pick(FAMILY)} ${pick(GIVEN)}`;
  } while (usedNames.has(name));
  usedNames.add(name);
  // Membership grows over time: a third were around from the start, the rest trickle in.
  const joinWeek = i <= 50 ? 0 : between(1, WEEKS - 3);
  players.push({
    id: `plr_${String(i).padStart(4, "0")}`,
    name,
    joinsAt: new Date(FIRST_WEEK.getTime() + joinWeek * 7 * DAY - between(1, 20) * DAY),
    frequency: pick([0.05, 0.1, 0.15, 0.25, 0.4]),
  });
}

// ---- sessions & bookings -------------------------------------------------
interface Slot { weekday: number; hour: number; minute: number; durationMin: number; title: string; capacity: number }
// weekday: 0 = Monday … 6 = Sunday, in club-local time
const SLOTS: Slot[] = [
  { weekday: 0, hour: 6, minute: 0, durationMin: 120, title: "Early Bird Open Play", capacity: 12 },
  { weekday: 0, hour: 18, minute: 30, durationMin: 120, title: "Monday Social", capacity: 16 },
  { weekday: 2, hour: 18, minute: 30, durationMin: 120, title: "Intermediate Drills", capacity: 12 },
  { weekday: 4, hour: 19, minute: 0, durationMin: 120, title: "Friday Night Play", capacity: 16 },
  { weekday: 5, hour: 7, minute: 0, durationMin: 150, title: "Weekend Open Play", capacity: 20 },
  { weekday: 6, hour: 20, minute: 0, durationMin: 120, title: "Sunday Ladder", capacity: 16 },
];
const JUNE_1 = localToUtc(2026, 6, 1, 0, 0);
const AUG_1 = localToUtc(2026, 8, 1, 0, 0);
const NATIONAL_DAY = localToUtc(2026, 9, 2, 0, 0);

const sessions: (string | number)[][] = [];
const bookings: (string | number)[][] = [];
let bookingSeq = 0;

for (let week = 0; week < WEEKS; week++) {
  for (const slot of SLOTS) {
    const startsAt = new Date(FIRST_WEEK.getTime() + (week * 7 + slot.weekday) * DAY + (slot.hour * 60 + slot.minute) * 60_000);
    const endsAt = new Date(startsAt.getTime() + slot.durationMin * 60_000);
    const id = `ses_${String(sessions.length + 1).padStart(4, "0")}`;
    const onNationalDay = startsAt >= NATIONAL_DAY && startsAt < new Date(NATIONAL_DAY.getTime() + DAY);
    const cancelled = onNationalDay || chance(0.035);
    sessions.push([id, MAIN_CLUB, slot.title, iso(startsAt), iso(endsAt), slot.capacity, cancelled ? "cancelled" : "scheduled"]);

    const happened = startsAt < NOW;
    // Attendance policy: none before June, about half in June–July, most from August.
    // The 06:00 session rarely has a host on site to take it.
    const recordRate = startsAt < JUNE_1 ? 0 : startsAt < AUG_1 ? 0.5 : 0.85;
    const recorded = happened && !cancelled && chance(slot.hour === 6 ? recordRate * 0.3 : recordRate);
    const partlyRecorded = recorded && chance(0.08);

    const growth = 0.7 + 0.6 * (week / WEEKS);
    const candidates = players.filter((p) => p.joinsAt < startsAt);
    // Shuffle before capping at capacity so a full session is not always the lowest player ids.
    const booked = candidates
      .filter((p) => chance(Math.min(0.95, p.frequency * growth * 1.6)))
      .map((p) => ({ p, key: rand() }))
      .sort((a, b) => a.key - b.key)
      .slice(0, slot.capacity)
      .map(({ p }) => p);

    for (const p of booked) {
      const createdAt = new Date(startsAt.getTime() - between(2, 96) * HOUR);
      if (createdAt >= NOW) continue; // nobody books from the future
      const add = (status: string, attended: string, at: Date) => {
        bookings.push([`bkg_${String(++bookingSeq).padStart(5, "0")}`, id, p.id, status, attended, iso(at)]);
      };
      if (chance(0.03)) {
        // Cancelled, then booked again for the same session.
        add("cancelled", "", createdAt);
      }
      if (chance(0.07)) {
        add("cancelled", "", createdAt);
        continue;
      }
      let attended = "";
      if (recorded && !(partlyRecorded && chance(0.4))) attended = chance(0.1) ? "false" : "true";
      const confirmedAt = new Date(createdAt.getTime() + between(0, 3) * HOUR);
      add("confirmed", attended, confirmedAt < NOW ? confirmedAt : createdAt);
    }
  }
}


await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_DIR + "clubs.csv", csv(["id", "name", "timezone", "created_at"], clubs));
await writeFile(OUT_DIR + "players.csv", csv(["id", "name", "created_at"], players.map((p) => [p.id, p.name, iso(p.joinsAt)])));
await writeFile(OUT_DIR + "sessions.csv", csv(["id", "club_id", "title", "starts_at", "ends_at", "capacity", "status"], sessions));
await writeFile(OUT_DIR + "bookings.csv", csv(["id", "session_id", "player_id", "status", "attended", "created_at"], bookings));
console.log(`Wrote ${clubs.length} clubs, ${players.length} players, ${sessions.length} sessions, ${bookings.length} bookings to ${OUT_DIR}`);
