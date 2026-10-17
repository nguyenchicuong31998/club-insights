import { daysInRange, formatDateTime, formatDay } from "@/lib/format";
import type { Meta, Summary } from "@/lib/types";

/**
 * A club with no held sessions gets an explanation, never a wall of zeros: what this page will
 * show, when each number appears, and the one habit that makes the numbers trustworthy.
 */
export function EmptyClub({ summary, meta }: { summary: Summary; meta: Meta }) {
  const { club, firstSessionAt } = summary;
  const age = daysInRange(club.createdOn, meta.today) - 1;
  const items = [
    { title: "Active players", when: "after your first session", def: meta.definitions.activePlayers },
    { title: "Sessions held", when: "as soon as a session starts", def: meta.definitions.sessionsHeld },
    { title: "No-shows", when: "once you take attendance at a session", def: meta.definitions.noShows },
  ];

  return (
    <div className="flex flex-col gap-10">
      <section className="max-w-3xl">
        <p className="text-sm font-medium text-accent">New club</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">No sessions yet, so nothing to count.</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-2">
          {club.name} was created on {formatDay(club.createdOn, { weekday: true, year: true })}
          {age >= 0 && <> ({age === 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`})</>}.{" "}
          {firstSessionAt
            ? <>The first session is on {formatDateTime(firstSessionAt, club.timezone)}. The numbers start from there.</>
            : <>Once you run sessions, this page fills in by itself: no setup needed.</>}
        </p>
      </section>

      <section aria-label="What you'll see here" className="grid border-y border-line md:grid-cols-3 md:divide-x md:divide-line max-md:divide-y max-md:divide-line">
        {items.map((i) => (
          <article key={i.title} className="flex flex-col gap-2 py-5 md:px-6 md:first:pl-0 md:last:pr-0">
            <h2 className="text-[15px] font-medium text-ink">{i.title}</h2>
            <p className="text-5xl font-semibold leading-none text-line-strong" aria-label="No value yet">—</p>
            <p className="text-sm text-ink-2">Appears {i.when}.</p>
            <p className="text-sm leading-relaxed text-ink-3">{i.def}</p>
          </article>
        ))}
      </section>

      <section className="max-w-3xl">
        <h2 className="text-lg font-semibold text-ink">Get numbers you can trust from the first week</h2>
        <ol className="mt-3 flex flex-col gap-3 text-ink-2">
          <li className="flex gap-3">
            <span className="tabular font-semibold text-accent">1</span>
            <span>
              <span className="font-medium text-ink">Take attendance at every session.</span> It&apos;s the only way to know
              who didn&apos;t show up. Where it isn&apos;t taken, no-shows stay &ldquo;unknown&rdquo;, not zero.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="tabular font-semibold text-accent">2</span>
            <span>
              <span className="font-medium text-ink">Cancel sessions you won&apos;t run</span> instead of leaving them empty, so
              &ldquo;sessions held&rdquo; stays honest.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="tabular font-semibold text-accent">3</span>
            <span>
              <span className="font-medium text-ink">Come back after a few weeks.</span> Each number is compared with the
              period before it, which needs some history to mean anything.
            </span>
          </li>
        </ol>
      </section>
    </div>
  );
}
