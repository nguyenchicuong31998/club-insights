"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Side panel on desktop, full screen on a phone. Closing just navigates to `closeHref` (URL holds the state). */
export function Drawer({ title, closeHref, children }: { title: string; closeHref: string; children: React.ReactNode }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [closeHref, router]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link href={closeHref} scroll={false} aria-label="Close" className="absolute inset-0 bg-black/30" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex h-full w-full flex-col overflow-hidden bg-page shadow-xl outline-none sm:max-w-3xl lg:max-w-4xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <h2 className="truncate text-lg font-semibold text-ink">{title}</h2>
          <Link href={closeHref} scroll={false} className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
            Close <span aria-hidden>✕</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
