/**
 * The debrief's own loading state. Without it this route inherits the run
 * screen's, which says "Loading your run" — wrong words for a run that has
 * already finished.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-wows-ink">
        Debrief
      </h1>
      <p role="status" className="mt-3 text-[15px] text-wows-muted">
        Working out what your decisions changed…
      </p>
    </main>
  );
}
