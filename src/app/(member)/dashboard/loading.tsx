export default function DashboardLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading dashboard"
      className="mx-auto w-full max-w-4xl flex-1 px-6 py-12"
    >
      <div className="h-7 w-48 rounded bg-wows-rule" />
      <div className="mt-2 h-4 w-64 rounded bg-wows-rule" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="h-28 rounded-md border border-wows-rule bg-wows-surface" />
        <div className="h-28 rounded-md border border-wows-rule bg-wows-surface" />
      </div>
    </main>
  );
}
