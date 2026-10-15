-- Recomputes the headline numbers in plain SQL, independently of the TypeScript domain code.
-- Run: npm run db:check   (expects the values in docs/metrics.md)
-- Current = 7 Sep – 4 Oct 2026, previous = 10 Aug – 6 Sep, local dates in Asia/Ho_Chi_Minh;
-- "now" = Mon 5 Oct 2026 09:00 local.

WITH p(period, a, b) AS (VALUES
  ('current',  timestamptz '2026-09-07 00:00+07', timestamptz '2026-10-05 00:00+07'),
  ('previous', timestamptz '2026-08-10 00:00+07', timestamptz '2026-09-07 00:00+07')),
held AS (
  SELECT p.period, s.id
  FROM p JOIN sessions s ON s.club_id = 'clb_saigon' AND s.starts_at >= p.a AND s.starts_at < p.b
  WHERE s.status = 'scheduled' AND s.starts_at < timestamptz '2026-10-05 09:00+07'),
bk AS (
  SELECT h.period, b.player_id, b.attended
  FROM held h JOIN bookings b ON b.session_id = h.id AND b.status = 'confirmed')
SELECT p.period,
  (SELECT count(*) FROM held h WHERE h.period = p.period) AS sessions_held,
  count(DISTINCT bk.player_id) FILTER (WHERE bk.attended IS DISTINCT FROM false) AS active_players,
  count(bk.player_id) AS confirmed_bookings,
  count(bk.attended) AS recorded_bookings,
  count(*) FILTER (WHERE bk.attended = false) AS no_shows,
  round(100.0 * count(*) FILTER (WHERE bk.attended = false) / NULLIF(count(bk.attended), 0), 1) AS no_show_rate_pct
FROM p LEFT JOIN bk ON bk.period = p.period
GROUP BY p.period
ORDER BY p.period;

-- Weeks by local Monday: expect 6 then 5. (Bucketing in UTC would give 1 / 6 / 4.)
SELECT date_trunc('week', s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS local_week, count(*) AS sessions_held
FROM sessions s
WHERE s.club_id = 'clb_saigon' AND s.status = 'scheduled'
  AND s.starts_at >= timestamptz '2026-09-07 00:00+07' AND s.starts_at < timestamptz '2026-09-21 00:00+07'
GROUP BY 1
ORDER BY 1;
