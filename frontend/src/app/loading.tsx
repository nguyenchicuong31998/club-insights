export default function Loading() {
  const block = "animate-pulse rounded-xl border border-line bg-surface";
  return (
    <div className="min-h-screen" aria-busy="true" aria-label="Loading">
      <div className="h-[61px] border-b border-line bg-surface" />
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-6">
        <div className={`${block} h-24`} />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className={`${block} h-60`} />)}
        </div>
        <div className={`${block} h-80`} />
      </main>
    </div>
  );
}
