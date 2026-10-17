import Link from "next/link";
import { formatCount, formatRange, formatSessionTime } from "@/lib/format";
import type { AttendanceStatus, Meta, PlayerRow, SessionDetail, SessionRow } from "@/lib/types";
import { hrefWith, type DrillView, type PageState } from "@/lib/url";

export const VIEW_LABEL: Record<DrillView, string> = {
  "sessions:held": "Sessions held",
  "players:active": "Active players",
  "players:no_show": "Players who didn't show",
  "sessions:with_no_shows": "Sessions with no-shows",
  "sessions:attendance_not_recorded": "Sessions missing attendance",
};

const VIEW_EXPLAINER: Record<DrillView, (m: Meta) => string> = {
  "sessions:held": (m) => m.definitions.sessionsHeld,
  "players:active": (m) => m.definitions.activePlayers,
  "players:no_show": () => "Players with at least one booking marked as did-not-attend. Sessions without attendance can't add to this list.",
  "sessions:with_no_shows": () => "Held sessions where at least one booking was marked as did-not-attend.",
  "sessions:attendance_not_recorded": () =>
    "Held sessions with at least one booking whose attendance wasn't taken. No-shows at these bookings are unknown, so they are left out of the no-show rate.",
};

const ATTENDANCE_BADGE: Record<AttendanceStatus, { label: string; cls: string }> = {
  recorded: { label: "Attendance taken", cls: "bg-good-soft text-good" },
  partly_recorded: { label: "Partly taken", cls: "bg-warn-soft text-warn" },
  not_recorded: { label: "Not taken", cls: "bg-surface-2 text-ink-2" },
  no_bookings: { label: "No bookings", cls: "bg-surface-2 text-ink-3" },
};

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const b = ATTENDANCE_BADGE[status];
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>;
}

function Tabs({ state, view }: { state: PageState; view: DrillView }) {
  return (
    <nav aria-label="Lists" className="mb-4 flex flex-wrap gap-1">
      {(Object.keys(VIEW_LABEL) as DrillView[]).map((v) => (
        <Link
          key={v}
          href={hrefWith(state, { view: v, session: undefined })}
          scroll={false}
          aria-current={v === view ? "page" : undefined}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
            v === view ? "bg-accent text-white" : "bg-surface text-ink-2 hover:text-ink"
          }`}
        >
          {VIEW_LABEL[v]}
        </Link>
      ))}
    </nav>
  );
}

function Intro({ count, noun, meta, view }: { count: number; noun: string; meta: Meta; view: DrillView }) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <p className="text-lg font-semibold text-ink tabular">
        {formatCount(count)} {noun} · {formatRange(meta.range.from, meta.range.to)}
      </p>
      <p className="text-sm text-ink-2">{VIEW_EXPLAINER[view](meta)}</p>
    </div>
  );
}

const th = "py-2 pr-3 font-medium whitespace-nowrap";
const td = "py-2.5 pr-3 align-top";

export function SessionsTable({ rows, meta, state, view }: { rows: SessionRow[]; meta: Meta; state: PageState; view: DrillView }) {
  return (
    <>
      <Tabs state={state} view={view} />
      <Intro count={rows.length} noun={rows.length === 1 ? "session" : "sessions"} meta={meta} view={view} />
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm tabular">
            <thead className="border-b border-line text-ink-2">
              <tr>
                <th className={`${th} pl-3`}>When ({meta.timezone})</th>
                <th className={th}>Session</th>
                <th className={`${th} text-right`}>Booked</th>
                <th className={`${th} text-right`}>Attended</th>
                <th className={`${th} text-right`}>No-show</th>
                <th className={`${th} text-right`}>Not taken</th>
                <th className={th}>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const t = formatSessionTime(s.startsAt, s.endsAt, meta.timezone);
                return (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className={`${td} pl-3 whitespace-nowrap`}>
                      <span className="text-ink">{t.day}</span> <span className="text-ink-2">{t.time}</span>
                    </td>
                    <td className={td}>
                      <Link href={hrefWith(state, { session: s.id })} scroll={false} className="font-medium text-accent hover:underline">
                        {s.title}
                      </Link>
                    </td>
                    <td className={`${td} text-right`}>{s.confirmedBookings}/{s.capacity}</td>
                    <td className={`${td} text-right`}>{s.attended}</td>
                    <td className={`${td} text-right ${s.noShows ? "font-semibold text-bad" : ""}`}>{s.noShows}</td>
                    <td className={`${td} text-right text-ink-2`}>{s.notRecorded}</td>
                    <td className={td}><AttendanceBadge status={s.attendanceStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function PlayersTable({ rows, meta, state, view }: { rows: PlayerRow[]; meta: Meta; state: PageState; view: DrillView }) {
  return (
    <>
      <Tabs state={state} view={view} />
      <Intro count={rows.length} noun={rows.length === 1 ? "player" : "players"} meta={meta} view={view} />
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm tabular">
            <thead className="border-b border-line text-ink-2">
              <tr>
                <th className={`${th} pl-3`}>Player</th>
                <th className={`${th} text-right`} title="Attended, or attendance not taken">Played</th>
                <th className={`${th} text-right`}>Attended</th>
                <th className={`${th} text-right`}>No-show</th>
                <th className={`${th} text-right`}>Not taken</th>
                <th className={th}>Last session</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className={`${td} pl-3`}>
                    <span className="font-medium text-ink">{p.name}</span>{" "}
                    <span className="text-xs text-ink-3">{p.id}</span>
                  </td>
                  <td className={`${td} text-right`}>{p.sessionsPlayed}</td>
                  <td className={`${td} text-right`}>{p.attended}</td>
                  <td className={`${td} text-right ${p.noShows ? "font-semibold text-bad" : ""}`}>{p.noShows}</td>
                  <td className={`${td} text-right text-ink-2`}>{p.notRecorded}</td>
                  <td className={`${td} whitespace-nowrap text-ink-2`}>
                    {formatSessionTime(p.lastSessionAt, p.lastSessionAt, meta.timezone).day}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-3 py-2 text-xs text-ink-2">
            “Played” counts bookings that were attended or where attendance wasn&apos;t taken; it excludes no-shows.
          </p>
        </div>
      )}
    </>
  );
}

function Empty() {
  return <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-2">Nothing in this period.</p>;
}

const ATTENDANCE_LABEL = {
  attended: { label: "Attended", icon: "✓", cls: "text-good" },
  no_show: { label: "No-show", icon: "✕", cls: "text-bad" },
  not_recorded: { label: "Not recorded", icon: "?", cls: "text-ink-3" },
} as const;

export function SessionDetailView({ session, timezone, backHref }: { session: SessionDetail; timezone: string; backHref: string }) {
  const t = formatSessionTime(session.startsAt, session.endsAt, timezone);
  const count = (a: keyof typeof ATTENDANCE_LABEL) => session.bookings.filter((b) => b.attendance === a).length;
  return (
    <div className="flex flex-col gap-4">
      <Link href={backHref} scroll={false} className="text-sm font-medium text-accent hover:underline">← Back to list</Link>
      <div>
        <p className="text-lg font-semibold text-ink">{session.title}</p>
        <p className="text-sm text-ink-2">
          {t.day} · {t.time} ({timezone})
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {session.status === "cancelled" ? (
            <span className="rounded bg-bad-soft px-1.5 py-0.5 text-xs font-medium text-bad">Cancelled — not counted</span>
          ) : !session.held ? (
            <span className="rounded bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn">Not started yet — not counted</span>
          ) : null}
          <AttendanceBadge status={session.attendanceStatus} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Booked", `${session.bookings.length}/${session.capacity}`],
          ["Attended", count("attended")],
          ["No-show", count("no_show")],
          ["Not recorded", count("not_recorded")],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-surface p-3">
            <dt className="text-xs text-ink-2">{k}</dt>
            <dd className="text-xl font-semibold text-ink tabular">{v}</dd>
          </div>
        ))}
      </dl>

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {session.bookings.map((b) => {
          const a = ATTENDANCE_LABEL[b.attendance];
          return (
            <li key={b.bookingId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="text-ink">{b.playerName}</span> <span className="text-xs text-ink-3">{b.playerId}</span>
              </span>
              <span className={`inline-flex items-center gap-1.5 font-medium ${a.cls}`}>
                <span aria-hidden>{a.icon}</span>
                {a.label}
              </span>
            </li>
          );
        })}
        {session.bookings.length === 0 && <li className="px-3 py-4 text-center text-sm text-ink-2">No bookings.</li>}
      </ul>
      {session.cancelledBookings > 0 && (
        <p className="text-sm text-ink-2">
          {session.cancelledBookings} cancelled booking{session.cancelledBookings > 1 ? "s" : ""} not shown and not counted.
        </p>
      )}
    </div>
  );
}
