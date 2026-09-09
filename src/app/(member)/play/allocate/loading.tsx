/**
 * Loading state, in the interface's voice. A blank screen is a defect, and a
 * shimmering skeleton is a guess at a layout that may not arrive.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-wows-ink">
        Allocation game
      </h1>
      <p role="status" className="mt-3 text-sm text-wows-muted">
        Loading your run…
      </p>
    </main>
  );
}
