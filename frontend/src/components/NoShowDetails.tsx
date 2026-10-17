import Link from "next/link";
import { formatCount, formatPercent, formatSessionTime, plural } from "@/lib/format";
import type { AttendanceBySessionType, Meta, PlayerRow } from "@/lib/types";

function SectionTitle({ title, note }: { title: string; note?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-col gap-1">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {note && <p className="text-sm leading-relaxed text-ink-2">{note}</p>}
    </div>
  );
}

/**
 * The no-show rate only describes sessions that took attendance. This shows which ones those
 * are, so a host can see that, say, Saturday's no-shows are simply not in the number.
 */
export function NoShowsBySession({ rows }: { rows: AttendanceBySessionType[] }) {
  if (rows.length === 0) return null;
  const never = rows.filter((r) => r.sessionsWithAttendance === 0).map((r) => r.title);
  const checked = rows.reduce((s, r) => s + r.recordedBookings, 0);
  const top = [...rows].sort((a, b) => b.recordedBookings - a.recordedBookings)[0];
  const topShare = checked ? top.recordedBookings / checked : 0;

  return (
    <section aria-labelledby="by-session" className="flex min-w-0 flex-col">
      <SectionTitle
        title="Where the no-show rate comes from"
        note={
          <>
            Only sessions that took attendance can have no-shows.
            {never.length > 0 && <> No attendance at <span className="font-medium text-ink">{never.join(", ")}</span>, so {never.length === 1 ? "its" : "their"} no-shows are unknown and not in the rate.</>}
            {checked > 0 && topShare >= 0.4 && <> {top.title} makes up {formatPercent(topShare, 0)} of the checked bookings.</>}
          </>
        }
      />
      <div id="by-session" className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm tabular">
          <thead className="border-b border-line-strong text-ink-3">
            <tr>
              <th className="py-2 pr-3 font-medium">Session</th>
              <th className="py-2 pr-3 font-medium">Attendance taken</th>
              <th className="py-2 pr-3 text-right font-medium">No-shows</th>
              <th className="py-2 text-right font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const share = r.sessionsHeld ? r.sessionsWithAttendance / r.sessionsHeld : 0;
              return (
                <tr key={r.title} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-ink">{r.title}</td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
                      </span>
                      <span className={r.sessionsWithAttendance === 0 ? "text-warn" : "text-ink-2"}>
                        {r.sessionsWithAttendance} of {r.sessionsHeld}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-ink">
                    {r.sessionsWithAttendance === 0 ? <span className="text-unknown">Unknown</span> : formatCount(r.noShows)}
                  </td>
                  <td className="py-2.5 text-right text-ink-2">
                    {r.recordedBookings ? formatPercent(r.noShows / r.recordedBookings) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The other half of the host's question: who it is that doesn't show up. */
export function WhoDidntShow({ players, total, unknown, meta, allHref }: {
  /** The worst few, already sorted by the API. */
  players: PlayerRow[];
  /** Everyone marked absent at least once. */
  total: number;
  /** No attendance at all in the period: say so rather than "nobody". */
  unknown: boolean;
  meta: Meta;
  allHref: string;
}) {
  const shown = players;
  return (
    <section aria-labelledby="who" className="flex min-w-0 flex-col">
      <SectionTitle
        title="Who didn't show up"
        note={unknown ? "Attendance wasn't taken in this period, so we can't tell." : "Marked absent at least once in this period, most no-shows first."}
      />
      {!unknown && shown.length === 0 && <p className="text-sm text-ink-2">Nobody was marked absent.</p>}
      {shown.length > 0 && (
        <ul id="who" className="divide-y divide-line border-y border-line">
          {shown.map((p) => {
            const checked = p.attended + p.noShows;
            return (
              <li key={p.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{p.name}</span> <span className="text-xs text-ink-3">{p.id}</span>
                  <span className="block text-xs text-ink-3">
                    Last booked {formatSessionTime(p.lastSessionAt, p.lastSessionAt, meta.timezone).day}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular">
                  <span className="font-semibold text-bad">{plural(p.noShows, "no-show")}</span>
                  <span className="block text-xs text-ink-3">of {plural(checked, "checked booking")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {total > shown.length && (
        <Link href={allHref} scroll={false} className="mt-3 text-sm font-medium text-accent underline-offset-4 hover:underline">
          See all {formatCount(total)} players <span aria-hidden>→</span>
        </Link>
      )}
    </section>
  );
}
