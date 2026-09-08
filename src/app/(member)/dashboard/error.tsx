"use client";

/**
 * A failed load surfaces here with a way to retry (H34). Never render the
 * dashboard as if the data were present.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12" role="alert">
      <h1 className="text-xl font-semibold text-wows-ink">
        The dashboard could not be loaded
      </h1>
      <p className="mt-2 text-sm text-wows-muted">
        Something failed while reading your data. Nothing was changed.
        {error.digest ? (
          <>
            {" "}
            Reference: <span className="numeric">{error.digest}</span>
          </>
        ) : null}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-wows-accent px-4 py-2 text-sm font-medium text-wows-surface hover:bg-wows-accent-soft"
      >
        Try again
      </button>
    </main>
  );
}
