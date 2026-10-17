# API

The API returns JSON only and is designed to be reused by the mobile app as is. Clients never do time zone
math or interpret raw attendance values.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }` |
| GET | `/api/clubs` | All clubs (for the switcher). |
| GET | `/api/clubs/:id` | One club. |
| GET | `/api/clubs/:id/summary?from&to` | The three metrics for the range and the previous period, with changes, coverage and definitions. |
| GET | `/api/clubs/:id/weekly?from&to` | All three metrics for every Monday–Sunday week overlapping the range. |
| GET | `/api/clubs/:id/sessions?from&to&filter` | The sessions behind a number. `filter`: `held` (default), `with_no_shows`, `attendance_not_recorded`. Newest first. |
| GET | `/api/clubs/:id/players?from&to&filter` | The players behind a number. `filter`: `active` (default), `no_show`. |
| GET | `/api/clubs/:id/sessions/:sessionId` | One session, with each booking labelled `attended`, `no_show` or `not_recorded`, plus a count of cancelled bookings. |

## Query parameters

- `from` and `to` are inclusive local dates (`YYYY-MM-DD`) in the club's time zone.
- Pass both or neither. Without them, the range is the last four complete weeks before now.
- The range can be at most 366 days and must not start after today.

## Response shape

Range endpoints return `{ data, meta }`. `meta` holds:

| Field | Meaning |
|---|---|
| `timezone`, `now`, `today` | The club's time zone, the fixed "now", and today's date in that zone. |
| `range` | `from`, `to`, `startUtc`, `endUtc`, and `partial` (true when the range reaches today, so part of it has not happened yet). |
| `previousRange` | The comparison period, in the same form. |
| `definitions` | The plain-language definition of each metric, to show next to it. |

## Values

| Value | Meaning |
|---|---|
| Timestamps | ISO-8601 in UTC. |
| Rates and relative changes | Fractions: `0.117` means 11.7%. |
| `change: null` | One side is unknown. Show "—". |
| `relative: null` | The previous value was 0. |
| `noShows.count: null` and `noShows.rate: null` | Unknown, because no attendance was taken in that period. Show "Unknown", never 0. |
| `recordedBookings` / `confirmedBookings` | The attendance coverage to show beside the number. `confirmedBookings` counts live bookings (status `booked` in the data), not cancelled ones. |
| `noShows.bySessionType` | Per recurring session (by title): sessions held, sessions that took attendance, checked bookings and no-shows. Shows which sessions the rate is really based on. |
| `hasHistory: false` | The club has never held a session. Show the empty state instead of zeros. |

## Errors

Errors return `{ "error": "<message the user can read>" }`:

| Status | When |
|---|---|
| 400 | Invalid date or filter, `from` after `to`, only one of the two dates given, or a range that is too long or starts after today. |
| 404 | Unknown club, unknown session, a session that belongs to another club, or an unknown route. |

Example:

```bash
curl "localhost:4000/api/clubs/club-001/summary?from=2026-09-07&to=2026-10-04"
```

```jsonc
{
  "data": {
    "club": { "id": "club-001", "name": "Saigon Smash Pickleball", "timezone": "Asia/Ho_Chi_Minh", "createdOn": "2025-12-01" },
    "firstSessionAt": "2026-01-04T22:30:00.000Z",
    "hasHistory": true,
    "metrics": {
      "sessionsHeld":  { "current": 20, "previous": 20, "change": { "absolute": 0, "relative": 0 }, "definition": "..." },
      "activePlayers": { "current": 89, "previous": 88, "change": { "absolute": 1, "relative": 0.0114 }, "definition": "..." },
      "noShows": {
        "current":  { "count": 15, "rate": 0.0993, "recordedBookings": 151, "confirmedBookings": 264, "sessionsWithAttendance": 11 },
        "previous": { "count": 14, "rate": 0.0921, "recordedBookings": 152, "confirmedBookings": 248, "sessionsWithAttendance": 12 },
        "rateChange": { "absolute": 0.0072, "relative": 0.0785 },
        "bySessionType": [
          { "title": "Early Bird Monday", "sessionsHeld": 4, "sessionsWithAttendance": 1, "recordedBookings": 14, "noShows": 1 },
          { "title": "Saturday Morning Social", "sessionsHeld": 4, "sessionsWithAttendance": 0, "recordedBookings": 0, "noShows": 0 },
          ...
        ],
        "definition": "..."
      }
    }
  },
  "meta": {
    "timezone": "Asia/Ho_Chi_Minh", "now": "2026-10-05T02:00:00.000Z", "today": "2026-10-05",
    "range": { "from": "2026-09-07", "to": "2026-10-04", "partial": false,
               "startUtc": "2026-09-06T17:00:00.000Z", "endUtc": "2026-10-04T17:00:00.000Z" },
    "previousRange": { "from": "2026-08-10", "to": "2026-09-06", ... },
    "definitions": { "sessionsHeld": "...", "activePlayers": "...", "noShows": "...", ... }
  }
}
```
