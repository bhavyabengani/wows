import Link from "next/link";
import {
  Chip,
  PageHeader,
  Section,
  SignedFigure,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { dashboard, previewUser, season } from "@/preview-data";

export const metadata = { title: "Dashboard" };

type State = "ready" | "loading" | "empty" | "error";

function parseState(value: string | undefined): State {
  return value === "loading" || value === "empty" || value === "error"
    ? value
    : "ready";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const state = parseState((await searchParams).state);

  const switcher = (
    <nav aria-label="Preview state" className="flex flex-wrap gap-1 text-xs">
      {(["ready", "loading", "empty", "error"] as const).map((s) => (
        <Link
          key={s}
          href={s === "ready" ? "/dashboard" : `/dashboard?state=${s}`}
          aria-current={state === s ? "page" : undefined}
          className={
            state === s
              ? "rounded-sm bg-wows-ink px-2 py-1 text-wows-paper"
              : "rounded-sm border border-wows-rule px-2 py-1 text-wows-muted hover:text-wows-ink"
          }
        >
          {s}
        </Link>
      ))}
    </nav>
  );

  if (state === "loading") {
    return (
      <main
        aria-busy="true"
        aria-label="Loading dashboard"
        className="flex flex-col gap-8"
      >
        <PageHeader
          title={previewUser.name}
          lede="Loading your standing…"
          aside={switcher}
        />
        <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-sm bg-wows-rule/70" />
            ))}
          </div>
          <div className="space-y-3">
            <div className="h-24 rounded-md bg-wows-rule/70" />
            <div className="h-40 rounded-md bg-wows-rule/70" />
          </div>
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex flex-col gap-8">
        <PageHeader title={previewUser.name} aside={switcher} />
        <div
          role="alert"
          className="rounded-md border border-wows-accent/40 bg-wows-surface p-5"
        >
          <h2 className="font-semibold text-wows-ink">
            Your standing could not be loaded
          </h2>
          <p className="mt-1 text-sm text-wows-muted">
            The server did not answer in time. Nothing was changed. Reference{" "}
            <span className="numeric">req_8f3a21</span>.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/dashboard" className={buttonClass.primary}>
              Try again
            </Link>
            <Link href="/events" className={buttonClass.secondary}>
              Go to events
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (state === "empty") {
    return (
      <main className="flex flex-col gap-8">
        <PageHeader
          title={previewUser.name}
          lede="No season is open right now."
          aside={switcher}
        />
        <div className="rounded-md border border-wows-rule bg-wows-surface p-5">
          <h2 className="font-semibold text-wows-ink">Between seasons</h2>
          <p className="mt-1 max-w-xl text-sm text-wows-muted">
            The core team opens a season at the start of each semester. Until
            then you can read published research, work through Foundations, and
            look at last season&apos;s settled leaderboards.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/learn" className={buttonClass.primary}>
              Continue Foundations
            </Link>
            <Link href="/research" className={buttonClass.secondary}>
              Published research
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title={previewUser.name}
        lede={
          <>
            {season.name}, week {season.week} of {season.weeks}.{" "}
            {previewUser.vertical}, {previewUser.cohort}.
          </>
        }
        aside={switcher}
      />

      <div className="grid gap-8 md:grid-cols-[2fr_3fr]">
        <Section
          title="Your standing"
          action={
            <Link href="/leaderboard" className={buttonClass.quiet}>
              All leaderboards
            </Link>
          }
        >
          <ul className="divide-y divide-wows-rule">
            {dashboard.standings.map((s) => (
              <li
                key={s.track}
                className="flex items-baseline justify-between gap-4 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-wows-ink">{s.track}</p>
                  <p className="numeric text-xs text-wows-muted">{s.value}</p>
                </div>
                <div className="text-right">
                  <p className="numeric text-sm text-wows-ink">
                    <span className="font-semibold">{s.rank}</span>
                    <span className="text-wows-muted"> / {s.of}</span>
                  </p>
                  <p className="numeric text-xs">
                    {s.delta === 0 ? (
                      <span className="text-wows-muted">— no change</span>
                    ) : s.delta > 0 ? (
                      <span className="text-wows-positive">
                        ▲ +{s.delta} since Monday
                      </span>
                    ) : (
                      <span className="text-wows-accent">
                        ▼ {s.delta} since Monday
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <div className="flex flex-col gap-8">
          <Section title="Active game">
            {dashboard.activeGames.map((g) => {
              const pct = Math.round((g.step / g.steps) * 100);
              return (
                <div
                  key={g.name}
                  className="rounded-md border border-wows-rule bg-wows-surface p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-wows-ink">{g.name}</p>
                    <p className="numeric text-sm text-wows-muted">
                      step {g.step} of {g.steps}
                    </p>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={g.step}
                    aria-valuemin={0}
                    aria-valuemax={g.steps}
                    aria-label="Run progress"
                    className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-wows-rule"
                  >
                    <div
                      className="h-full bg-wows-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="text-wows-muted">
                      Closes <When iso={g.closesAt} />
                    </p>
                    <Link href={g.href} className={buttonClass.primary}>
                      Continue run
                    </Link>
                  </div>
                </div>
              );
            })}
          </Section>

          <Section title="Deadlines">
            <ul className="divide-y divide-wows-rule">
              {dashboard.deadlines.map((d) => (
                <li
                  key={d.label}
                  className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <Link
                    href={d.href}
                    className="text-sm text-wows-ink underline-offset-4 hover:underline"
                  >
                    {d.label}
                  </Link>
                  <When
                    iso={d.at}
                    className="shrink-0 text-xs text-wows-muted"
                  />
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Next event">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-medium text-wows-ink">
                  {dashboard.nextEvent.title}
                </p>
                <p className="text-sm text-wows-muted">
                  <When iso={dashboard.nextEvent.startsAt} />,{" "}
                  {dashboard.nextEvent.location}
                </p>
              </div>
              <Chip tone="positive">Going</Chip>
            </div>
          </Section>
        </div>
      </div>

      <p className="text-xs text-wows-muted">
        Figures are sample data. The real dashboard reads its numbers from the
        server on every load. <SignedFigure bps={0} className="sr-only" />
      </p>
    </main>
  );
}
