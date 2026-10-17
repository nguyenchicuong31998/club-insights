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
      {/* Looks like the page title; it is a native select, so it works with keyboard and screen readers. */}
      <span className="relative min-w-0">
        <select
          value={current}
          disabled={pending}
          onChange={(e) =>
            startTransition(() => router.push(hrefWith(state, { club: e.target.value, view: undefined, session: undefined })))
          }
          className="min-w-0 max-w-full cursor-pointer appearance-none [field-sizing:content] truncate rounded-md bg-transparent py-0.5 pr-8 text-2xl font-semibold tracking-tight text-ink hover:bg-surface-2 sm:text-3xl"
        >
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-3">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {pending && <span className="text-sm text-ink-3" aria-live="polite">Loading…</span>}
    </label>
  );
}
