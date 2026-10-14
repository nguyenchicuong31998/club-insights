# Metric definitions

This file is the source of truth for every number on the dashboard. The API returns the
short definition next to each value, and the UI shows it under the number. If code and this
file disagree, the code is wrong.

## Ground rules

| Rule | Decision |
|---|---|
| **Now** | Fixed at **Mon 5 Oct 2026 09:00 Asia/Ho_Chi_Minh** (`2026-10-05T02:00:00Z`). Set in config (`NOW`), never read from the system clock, so numbers are reproducible. |
| **Time zone** | Every date, range and week is in the **club's** time zone (`clubs.timezone`). Data is stored in UTC and converted at query time. |
| **Which day a session belongs to** | The local calendar date of `starts_at`. A session starting 06:00 Monday local (23:00 Sunday UTC) belongs to Monday. |
| **Date range** | Two local dates, `from` and `to`, both **inclusive**. They become the half-open UTC interval `[from 00:00 local, to+1 00:00 local)`. |
| **Future** | Only sessions that started **before now** count. A range reaching past now is cut at now and labelled *partial*. |
| **Previous period** | The same number of days, ending the day before `from`. Example: 7 Sep–4 Oct (28 days) is compared with 10 Aug–6 Sep. The UI always prints both date spans. |
| **Default range** | The last 4 complete weeks: Mon 7 Sep – Sun 4 Oct 2026. |
| **Weeks** | Monday 00:00 to Sunday 24:00, local time. |
| **Cancelled** | Cancelled sessions and cancelled bookings are excluded from every metric. A player who cancels and rebooks the same session is counted once. |

## Sessions held

> Sessions that started in the range and were not cancelled.

- `status = 'scheduled'` and `starts_at` is inside the range and before now.
- A session with no bookings still counts, since it was on the schedule and the host ran it. The drill-down shows its 0 bookings, so such sessions are visible rather than hidden.
- **Drill-down:** the list of these sessions with date, time, title, bookings / capacity, and attendance status (recorded, partly recorded, not recorded).

## Active players

> Different players with at least one confirmed booking at a session held in the range, not counting bookings marked as no-show.

- Each player counts once, however many sessions they played.
- **Booking with attendance not recorded:** the player still counts. Before June 2026 no attendance was taken at all, so excluding these players would report almost nobody as active, which is false.
- **Booking marked as no-show** (`attended = false`): the player is not counted for that booking. They booked but did not play.
- **Weekly chart:** the same definition, computed separately for each week. A player active in three weeks appears in three bars, so the weekly values do not add up to the range total.
- **Drill-down:** the players behind the number, with sessions played and their last session.

## No-shows

> Confirmed bookings marked as did-not-attend, at held sessions in the range. Only counted where attendance was taken.

- **Count:** bookings with `attended = false`.
- **Rate:** no-shows ÷ bookings with attendance recorded (`attended IS NOT NULL`). Bookings without recorded attendance are left out of **both** the numerator and the denominator.
- **Coverage**, always shown next to the number: "attendance recorded for X of Y bookings (Z%)".
- **Unknown, not zero:** when no booking in the range has attendance recorded, the value is `null`, shown as **"Unknown — attendance wasn't taken"**, never as 0.
- **Comparison** with the previous period uses the **rate**, not the count. The count depends on how many sessions were checked in, which changes from week to week. If either period is Unknown, the change is "—".
- **Drill-down:** sessions with no-shows and the players marked absent. Each booking shows **Attended**, **No-show** or **Not recorded**.

## Change versus the previous period

- Both values are shown: the absolute difference ("+6") and the percentage ("+5.7%").
- If the previous value is 0 or Unknown, the percentage is "—". The tool never divides by zero.
- For no-shows, the change is in percentage points of the rate (for example "+2.3 pts"), and a higher rate is shown as worse.

## Empty club

A club with no held sessions in the range shows no zeros. It shows a message that the club was created on <date> and has no sessions yet, explains when each number will appear, and gives the definitions so the host knows what to expect.

## Expected values (sample data, Saigon Pickleball Club)

These were computed by hand in SQL against `backend/data/*.csv` and will become test fixtures.

| | Current: 7 Sep – 4 Oct | Previous: 10 Aug – 6 Sep |
|---|---|---|
| Sessions held | 22 | 22 |
| Active players | 112 | 106 |
| Players with a confirmed booking (before no-shows are removed) | 115 | 108 |
| Confirmed bookings | 306 | 315 |
| Bookings with attendance recorded | 230 (75%) | 191 (61%) |
| No-shows | 27 | 18 |
| No-show rate | 11.7% | 9.4% |

The no-show count rose by 50%, but coverage also rose. The fair comparison is the rate: up 2.3 points.

Weekly active players, by local Monday: 10 Aug 57, 17 Aug 52, 24 Aug 56, 31 Aug 47, 7 Sep 60,
14 Sep 52, 21 Sep 59, 28 Sep 52, and 5 Oct 11. The 5 Oct week is **partial**: so far only the 06:00 Monday session has happened.

**Time zone check:** bucketing weeks in UTC instead of local time moves the Mon 7 Sep 06:00 session
into the week of 31 Aug (UTC weeks give 1 / 6 / 4 sessions instead of 6 / 5 for 7–20 Sep). The tests must cover this.

## Decisions to confirm

1. A held session with zero bookings counts as held (see Sessions held).
2. A player who only no-showed is not active. A player whose attendance was not recorded is active.
3. The UI language is English, matching the brief.
