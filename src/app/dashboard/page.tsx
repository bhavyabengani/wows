import Link from "next/link";
import { cn } from "cn";
import {
  Callout,
  Chip,
  PageHeader,
  Section,
  Sparkline,
  StepStrip,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { dashboard, previewUser, season } from "@/preview-data";

export const metadata = { title: "Dashboard" };

type State = "ready" | "loading" | "empty" | "error";
const parseState = (v: string | undefined): State =>
  v === "loading" || v === "empty" || v === "error" ? v : "ready";

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
              ? "bg-wows-ink px-2 py-1 text-wows-paper"
              : "border border-wows-rule px-2 py-1 text-wows-muted hover:text-wows-ink"
          }
        >
          {s}
        </Link>
      ))}
    </nav>
  );
  const lede = (
    <>
      {season.name}, week {season.week} of {season.weeks}.{" "}
      {previewUser.vertical}, {previewUser.cohort}.
    </>
  );

  if (state === "loading") {
    return (
      <main className="flex flex-col gap-8" aria-busy="true">
        <PageHeader title={previewUser.name} lede={lede} aside={switcher} />
        <p
          role="status"
          className="border-t border-wows-rule pt-4 text-[15px] text-wows-muted"
        >
          Loading standings…
        </p>
      </main>
    );
  }
  if (state === "error") {
    return (
      <main className="flex flex-col gap-8">
        <PageHeader title={previewUser.name} lede={lede} aside={switcher} />
        <Callout>
          <div role="alert">
            <h2 className="text-xl font-semibold tracking-tight text-wows-ink">
              Your standing could not be loaded
            </h2>
            <p className="mt-1 text-[15px] text-wows-muted">
              The server did not answer in time. Nothing was changed. Reference{" "}
              <span className="numeric">req_8f3a21</span>.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/dashboard" className={buttonClass.primary}>
                Try again
              </Link>
              <Link href="/events" className={buttonClass.quiet}>
                Go to events instead
              </Link>
            </div>
          </div>
        </Callout>
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
        <Section title="Between seasons">
          <p className="max-w-xl text-[15px] leading-relaxed text-wows-muted">
            The core team opens a season at the start of each semester. Until
            then you can read published research, work through Foundations, and
            look at last season&apos;s settled leaderboards.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/learn" className={buttonClass.primary}>
              Continue Foundations
            </Link>
            <Link href="/research" className={buttonClass.secondary}>
              Published research
            </Link>
          </div>
        </Section>
      </main>
    );
  }

  const overall = dashboard.standings.find((s) => s.track === "Overall")!;
  const game = dashboard.activeGames[0]!;
  return (
    <main className="flex flex-col gap-10">
      <PageHeader title={previewUser.name} lede={lede} aside={switcher} />

      <section className="grid gap-8 border-t border-wows-ink pt-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-[15px] text-wows-muted">Overall this season</p>
          <p className="numeric mt-1 text-[56px] leading-none font-medium tracking-tight text-wows-ink sm:text-[72px]">
            {overall.rank}
            <span className="text-[0.4em] font-normal text-wows-muted">
              {" "}
              of {overall.of}
            </span>
          </p>
          <p className="mt-2 text-[15px]">
            <span className="numeric text-wows-ink">{overall.value}</span>
            <span className="text-wows-muted"> index · </span>
            <span className="numeric text-wows-positive">
              ▲ +{overall.delta} since Monday
            </span>
          </p>
        </div>
        <Sparkline
          values={overall.series}
          width={200}
          height={56}
          tone="accent"
          className="justify-self-start md:justify-self-end"
        />
      </section>

      <div className="grid gap-10 md:grid-cols-[3fr_2fr]">
        <Section
          title="Standing by track"
          action={
            <Link href="/leaderboard" className={buttonClass.quiet}>
              All leaderboards
            </Link>
          }
        >
          <ul className="divide-y divide-wows-rule">
            {dashboard.standings
              .filter((s) => s.track !== "Overall")
              .map((s) => (
                <li
                  key={s.track}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-wows-ink">
                      {s.track}
                    </p>
                    <p className="text-[12.5px] text-wows-muted">
                      <span className="numeric text-wows-ink">{s.value}</span>{" "}
                      {s.unit}
                    </p>
                  </div>
                  <Sparkline values={s.series} />
                  <div className="w-[7.5rem] text-right">
                    <p className="numeric text-[22px] leading-none text-wows-ink">
                      {s.rank}
                      <span className="text-[0.55em] text-wows-muted">
                        {" "}
                        / {s.of}
                      </span>
                    </p>
                    <p
                      className={cn(
                        "numeric mt-1 text-[12.5px]",
                        s.delta > 0
                          ? "text-wows-positive"
                          : s.delta < 0
                            ? "text-wows-accent"
                            : "text-wows-muted",
                      )}
                    >
                      {s.delta > 0
                        ? `▲ +${s.delta}`
                        : s.delta < 0
                          ? `▼ ${s.delta}`
                          : "— 0"}{" "}
                      wk
                    </p>
                  </div>
                </li>
              ))}
          </ul>
        </Section>

        <div className="flex flex-col gap-8">
          <Section title="Active game">
            <p className="text-[15px] font-medium text-wows-ink">{game.name}</p>
            <StepStrip
              steps={game.steps}
              current={game.step}
              className="mt-3"
            />
            <p className="numeric mt-2 text-[12.5px] text-wows-muted">
              step {game.step} of {game.steps} · closes{" "}
              <When iso={game.closesAt} />
            </p>
            <Link href={game.href} className={`${buttonClass.primary} mt-4`}>
              Continue run
            </Link>
          </Section>

          <Section title="Deadlines">
            <ul className="divide-y divide-wows-rule">
              {dashboard.deadlines.map((d, i) => (
                <li key={d.label} className="py-3">
                  <Link
                    href={d.href}
                    className={cn(
                      "text-[15px] leading-snug underline-offset-4 hover:underline",
                      i === 0 ? "font-medium text-wows-ink" : "text-wows-ink",
                    )}
                  >
                    {d.label}
                  </Link>
                  <When
                    iso={d.at}
                    className={cn(
                      "mt-0.5 block text-[12.5px]",
                      i === 0 ? "text-wows-accent" : "text-wows-muted",
                    )}
                  />
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Next event">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[15px] font-medium text-wows-ink">
                  {dashboard.nextEvent.title}
                </p>
                <p className="text-[12.5px] text-wows-muted">
                  <When iso={dashboard.nextEvent.startsAt} />,{" "}
                  {dashboard.nextEvent.location}
                </p>
              </div>
              <Chip tone="positive">Going</Chip>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
