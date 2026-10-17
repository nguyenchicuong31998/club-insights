// Same shape as the page, so nothing jumps when the numbers arrive.
export default function Loading() {
  const bar = "animate-pulse rounded bg-surface-2";
  return (
    <div className="min-h-screen" aria-busy="true" aria-label="Loading">
      <div className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 pb-4 pt-5 sm:px-6 sm:pt-7">
          <div className={`${bar} h-3 w-20`} />
          <div className={`${bar} mt-2 h-8 w-72`} />
        </div>
      </div>
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-6 sm:gap-10 sm:px-6 sm:pt-8">
        <div className={`${bar} h-6 w-96 max-w-full`} />
        <div className="flex max-w-4xl flex-col gap-2">
          <div className={`${bar} h-7 w-full`} />
          <div className={`${bar} h-7 w-2/3`} />
        </div>
        <div className="grid gap-6 border-y border-line py-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className={`${bar} h-4 w-28`} />
              <div className={`${bar} h-12 w-24`} />
              <div className={`${bar} h-4 w-40`} />
            </div>
          ))}
        </div>
        <div className={`${bar} h-64`} />
      </main>
    </div>
  );
}
