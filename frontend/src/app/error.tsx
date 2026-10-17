"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-3 px-4">
      <p className="text-lg font-semibold text-ink">Something went wrong loading the numbers</p>
      <p className="text-sm text-ink-2">{error.message || "Unexpected error."}</p>
      <button type="button" onClick={reset} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white dark:text-page">
        Try again
      </button>
    </main>
  );
}
