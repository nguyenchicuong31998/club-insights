import { formatDateTime, formatDay } from "@/lib/format";
import type { Meta, Summary } from "@/lib/types";

/** A club with no held sessions gets an explanation of what will appear, never a wall of zeros. */
export function EmptyClub({ summary, meta }: { summary: Summary; meta: Meta }) {
  const { club, firstSessionAt } = summary;
  const items = [
    { title: "Active players", when: "after the first session is held", def: meta.definitions.activePlayers },
    { title: "Sessions held", when: "as soon as a session has started", def: meta.definitions.sessionsHeld },
    {
      title: "No-shows",
      when: "once you take attendance at a session — without it, no-shows stay “Unknown”, not zero",
      def: meta.definitions.noShows,
    },
  ];
  return (
    <section className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-5 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">New club</p>
        <h2 className="text-2xl font-semibold text-ink">{club.name} hasn&apos;t held a session yet</h2>
        <p className="max-w-2xl text-ink-2">
          The club was created on {formatDay(club.createdOn, { weekday: true, year: true })}.{" "}
          {firstSessionAt
            ? `The first session is scheduled for ${formatDateTime(firstSessionAt, club.timezone)}; numbers start from there.`
            : "No sessions are scheduled yet. Once sessions are held, this page fills in automatically."}
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">What you&apos;ll see here</h3>
        <ul className="grid gap-3 md:grid-cols-3">
          {items.map((i) => (
            <li key={i.title} className="flex flex-col gap-1.5 rounded-lg border border-dashed border-line p-4">
              <span className="font-semibold text-ink">{i.title}</span>
              <span className="text-sm text-ink-2">Appears {i.when}.</span>
              <span className="text-sm text-ink-3">{i.def}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg bg-surface-2 p-4 text-sm text-ink-2">
        <span className="font-semibold text-ink">Tip: </span>
        take attendance at every session from the start. It&apos;s the only way to know your no-show rate, and
        the numbers are only as complete as the attendance behind them.
      </div>
    </section>
  );
}
