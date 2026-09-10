"use client";

/**
 * A debrief that cannot be built says so (H34). It never renders a partial
 * comparison, because a missing counterfactual would read as a real number.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-wows-ink">
        Your debrief could not be built
      </h1>
      <p className="mt-3 max-w-prose text-[15px] text-wows-muted">
        Your run and everything in it are safe; only this summary failed. Try
        again, and if it keeps failing tell the core team and quote this
        reference.
      </p>
      {error.digest ? (
        <p className="numeric mt-2 text-xs text-wows-muted">
          Reference {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex items-center justify-center bg-wows-accent px-4 py-2 text-sm font-semibold text-wows-paper hover:bg-wows-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
      >
        Try again
      </button>
    </main>
  );
}
