"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Club } from "@/lib/types";
import { hrefWith, type PageState } from "@/lib/url";

export function ClubSwitcher({ clubs, state, current }: { clubs: Club[]; state: PageState; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Club</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) =>
          startTransition(() => router.push(hrefWith(state, { club: e.target.value, view: undefined, session: undefined })))
        }
        className="min-w-0 max-w-full truncate rounded-lg border border-line bg-surface px-3 py-2 text-base font-semibold text-ink shadow-sm focus:outline-2 focus:outline-accent sm:text-lg"
      >
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {pending && <span className="text-sm text-ink-3" aria-live="polite">Loading…</span>}
    </label>
  );
}
