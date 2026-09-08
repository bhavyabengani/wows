/**
 * Phase 0 placeholder. Its only jobs are to prove the design tokens load and
 * to give the end-to-end smoke test something to look at. It is replaced by
 * the public landing page in a later phase.
 */
export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-wows-ink">
        Wolves of Wall Street
      </h1>
      <p className="mt-2 text-wows-muted">
        Member portal. Under construction, Phase 0 of 12.
      </p>

      <section
        aria-label="Design token check"
        className="mt-10 rounded-md border border-wows-rule bg-wows-surface p-6"
      >
        <h2 className="text-sm font-medium text-wows-muted">Token check</h2>
        <dl className="numeric mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-wows-muted">Ink</dt>
            <dd className="text-wows-ink">1,00,000.00</dd>
          </div>
          <div>
            <dt className="text-wows-muted">Positive</dt>
            <dd className="text-wows-positive">▲ +2,340.50</dd>
          </div>
          <div>
            <dt className="text-wows-muted">Negative</dt>
            <dd className="text-wows-accent">▼ −1,120.25</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm">
          <a
            href="https://github.com/bhavyabengani/wows"
            className="text-wows-accent-soft underline underline-offset-4"
          >
            Source repository
          </a>
        </p>
      </section>
    </main>
  );
}
