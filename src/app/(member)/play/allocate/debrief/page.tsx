import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { withUser } from "@/db/client";
import { runs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { buildDebrief } from "@/lib/runs/debrief-data";
import { loadRun } from "@/lib/runs/repository";
import { formatInIST } from "@/lib/time";
import { DebriefDisclosure } from "./disclosure";
import { Timeline } from "./timeline";

export const metadata = { title: "Debrief — WOWS Portal" };
export const dynamic = "force-dynamic";

function rupees(paise: string, options: { paise?: boolean } = {}): string {
  const value = BigInt(paise);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = (abs / 100n).toString();
  const grouped =
    whole.length <= 3
      ? whole
      : `${whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${whole.slice(-3)}`;
  const fraction = options.paise
    ? `.${(abs % 100n).toString().padStart(2, "0")}`
    : "";
  return `${negative ? "−" : ""}₹${grouped}${fraction}`;
}

/**
 * The debrief.
 *
 * The lead figure is deliberately **not** the final corpus. Members are
 * assessed on reasoning, not returns, and a screen that opens with "you turned
 * five lakh into nine" teaches the opposite of what the club has committed to
 * teaching. What leads is the gap between what the player did and what doing
 * nothing would have done.
 *
 * Everything generated here describes; nothing prescribes. No model is called.
 */
export default async function DebriefPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const requested = (await searchParams).run;

  const view = await withUser(user.id, async (tx) => {
    let runId = requested ?? null;
    if (runId === null) {
      const recent = await tx
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.userId, user.id), eq(runs.state, "completed")))
        .orderBy(desc(runs.completedAt))
        .limit(1);
      runId = recent[0]?.id ?? null;
    }
    if (runId === null) return null;
    const loaded = await loadRun(tx, runId, user.id);
    if (loaded.state.status !== "completed") return "unfinished" as const;
    return buildDebrief(tx, loaded);
  });

  if (view === null) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-wows-ink">
          Debrief
        </h1>
        <p className="mt-3 max-w-prose text-[15px] text-wows-muted">
          You have not finished a run yet. A debrief appears here once you have
          played one to the end.
        </p>
        <Link
          href="/play/allocate"
          className="mt-5 inline-flex items-center justify-center bg-wows-accent px-4 py-2 text-sm font-semibold text-wows-paper hover:bg-wows-accent-soft"
        >
          Go to the game
        </Link>
      </main>
    );
  }

  if (view === "unfinished") {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-wows-ink">
          That run is still going
        </h1>
        <p className="mt-3 max-w-prose text-[15px] text-wows-muted">
          The debrief is written when a run reaches its final month. Yours has
          not, so there is nothing to compare yet.
        </p>
        <Link
          href="/play/allocate"
          className="mt-5 inline-flex items-center justify-center bg-wows-accent px-4 py-2 text-sm font-semibold text-wows-paper hover:bg-wows-accent-soft"
        >
          Back to the run
        </Link>
      </main>
    );
  }

  const gap = BigInt(view.gapToDidNothingPaise);
  const sign = gap > 0n ? 1 : gap < 0n ? -1 : 0;
  const arrow = sign > 0 ? "▲" : sign < 0 ? "▼" : "—";
  const tone =
    sign > 0
      ? "text-wows-positive"
      : sign < 0
        ? "text-wows-accent"
        : "text-wows-muted";
  const word = sign > 0 ? "ahead of" : sign < 0 ? "behind" : "level with";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-wows-ink">
          Debrief: {view.scenarioName}
        </h1>
        <span
          className={`border px-2 py-0.5 text-xs font-medium ${
            view.mode === "ranked"
              ? "border-wows-accent bg-wows-accent text-wows-paper"
              : "border-wows-rule text-wows-muted"
          }`}
        >
          {view.mode === "ranked" ? "Ranked attempt" : "Practice, not ranked"}
        </span>
      </div>

      {/* 1 — the comparison. The gap leads; the three corpora are context. */}
      <section
        aria-labelledby="comparison"
        className="mt-8 border-t border-wows-ink pt-5"
      >
        <h2 id="comparison" className="sr-only">
          What your decisions changed
        </h2>
        <p className="text-[15px] text-wows-muted">
          Against leaving your opening allocation alone
        </p>
        {view.neverTradedAfterOpening ? (
          <p
            data-testid="gap-to-did-nothing"
            className="numeric mt-1 max-w-prose font-sans text-[19px] leading-snug text-wows-ink"
          >
            You set an allocation and never traded again, so this run{" "}
            <em className="not-italic font-medium">is</em> the do-nothing
            comparison. There is no gap to report.
          </p>
        ) : (
          <>
            <p
              data-testid="gap-to-did-nothing"
              className={`numeric mt-1 text-[40px] leading-none font-medium tracking-tight sm:text-[52px] ${tone}`}
            >
              <span aria-hidden="true">{arrow} </span>
              <span className="sr-only">{word} </span>
              {sign > 0 ? "+" : ""}
              {rupees(view.gapToDidNothingPaise, { paise: true })}
            </p>
            <p className={`numeric mt-2 text-[17px] ${tone}`}>
              {sign > 0 ? "+" : ""}
              {(view.gapToDidNothingBps / 100).toFixed(2)}%
              <span className="text-wows-muted"> against doing nothing</span>
            </p>
          </>
        )}

        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[13px] text-wows-muted">Your corpus</dt>
            <dd
              data-testid="final-corpus"
              className="numeric mt-0.5 text-[19px] text-wows-ink"
            >
              {rupees(view.finalValuePaise)}
            </dd>
          </div>
          {view.counterfactuals.map((cf) => (
            <div key={cf.key}>
              <dt className="text-[13px] text-wows-muted">{cf.label}</dt>
              <dd className="numeric mt-0.5 text-[19px] text-wows-ink">
                {rupees(cf.finalValuePaise)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13px] text-wows-muted">
          All three received the same income, the same expenses and the same
          unplanned expense, so the difference between them is decisions and
          nothing else. Started from {rupees(view.startingCorpusPaise)}.
        </p>
      </section>

      {/* 2 — one finding, described rather than prescribed. */}
      <section className="mt-10 border-t border-wows-rule pt-5">
        <h2 className="text-[17px] font-semibold text-wows-ink">
          What stood out
        </h2>
        <p
          data-testid="finding"
          className="mt-2 max-w-prose text-[17px] leading-relaxed text-wows-ink"
        >
          {view.finding.sentence}
        </p>
        <p className="mt-2 text-[13px] text-wows-muted">
          {view.finding.supporting.label}:{" "}
          <span className="numeric text-wows-ink">
            {view.finding.supporting.value}
          </span>
        </p>
      </section>

      {/* 3 — the shock: the emergency-fund lesson gets its own row. */}
      <section className="mt-10 border-t border-wows-rule pt-5">
        <h2 className="text-[17px] font-semibold text-wows-ink">
          The unplanned expense
        </h2>
        <p
          data-testid="shock-line"
          className="mt-2 max-w-prose text-[17px] leading-relaxed text-wows-ink"
        >
          {view.shock.sentence}
        </p>
      </section>

      {/* 4 — the timeline, with the price-basis caveat attached to it. */}
      <section className="mt-10 border-t border-wows-rule pt-5">
        <h2 className="text-[17px] font-semibold text-wows-ink">
          Your run, month by month
        </h2>
        <Timeline points={view.timeline} />
        <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-wows-muted">
          Every series here is price-return: dividends are not included for any
          instrument, so equity returns are understated by roughly the dividend
          yield. Prices are adjusted for corporate actions as of{" "}
          {view.priceBasis.adjustedAsOf === "unknown"
            ? "the snapshot's fetch date"
            : formatInIST(`${view.priceBasis.adjustedAsOf}T00:00:00Z`, {
                withTime: false,
              })}
          , which means a level shown here is not the level that traded on the
          day.
          {view.priceBasis.usedSyntheticPrices
            ? " Some months had no trade in at least one holding; those were valued at the previous available close."
            : ""}
        </p>
      </section>

      {/* 5 — everything else, collapsed. */}
      <DebriefDisclosure view={view} />

      <div className="mt-10 flex flex-wrap gap-3 border-t border-wows-rule pt-5">
        <Link
          href="/play/allocate"
          className="inline-flex items-center justify-center border border-wows-ink px-4 py-2 text-sm font-semibold text-wows-ink hover:bg-wows-surface"
        >
          Back to the game
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-2 py-2 text-sm font-medium text-wows-accent underline underline-offset-4"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
