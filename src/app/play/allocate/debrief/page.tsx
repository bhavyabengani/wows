import Link from "next/link";
import { cn } from "cn";
import {
  Money,
  PageHeader,
  Panel,
  Section,
  SignedFigure,
  SimulationDisclaimer,
  When,
  buttonClass,
  td,
  tdNum,
  th,
  thNum,
  TableWrap,
} from "@/components/preview/ui";
import { debrief } from "@/preview-data";

export const metadata = { title: "Debrief" };

const FLAG: Record<
  NonNullable<(typeof debrief.timeline)[number]["flag"]>,
  { label: string; tone: string }
> = {
  "over-trading": { label: "Over-trading", tone: "text-wows-accent" },
  panic: { label: "Panic", tone: "text-wows-accent" },
  concentration: { label: "Concentration", tone: "text-wows-accent" },
  good: { label: "Held to plan", tone: "text-wows-positive" },
};

export default function DebriefPage() {
  const yours = debrief.counterfactuals[0]!;
  const max = debrief.counterfactuals.reduce(
    (m, c) => (c.finalPaise > m ? c.finalPaise : m),
    0n,
  );
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Debrief: 2024 H1 replay"
        lede="The run is over. This page is the point of the game: what you did, what doing nothing would have done, and the habits that showed up."
        aside={
          <Link href="/play/allocate" className={buttonClass.secondary}>
            Back to the game
          </Link>
        }
      />
      <SimulationDisclaimer />

      <section className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <p className="text-xs text-wows-muted">Final corpus</p>
          <p className="numeric text-3xl font-semibold text-wows-ink">
            <Money paise={debrief.finalPaise} />
          </p>
          <p className="mt-1 text-sm">
            <SignedFigure paise={debrief.finalPaise - debrief.startPaise} /> on{" "}
            <Money paise={debrief.startPaise} className="text-wows-muted" />
          </p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs text-wows-muted">
            Against the two counterfactuals
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {debrief.counterfactuals.map((c) => {
              const pct = Number((c.finalPaise * 1000n) / max) / 10;
              const diff = c.finalPaise - yours.finalPaise;
              return (
                <li
                  key={c.key}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[12rem_1fr_auto]"
                >
                  <span
                    className={cn(
                      "text-sm",
                      c.key === "yours"
                        ? "font-medium text-wows-ink"
                        : "text-wows-ink",
                    )}
                  >
                    {c.label}
                  </span>
                  <div
                    className="col-span-2 h-2 w-full rounded-full bg-wows-rule sm:col-span-1"
                    aria-hidden="true"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        c.key === "yours" ? "bg-wows-accent" : "bg-wows-muted",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="numeric col-start-2 row-start-1 text-right text-sm sm:col-start-3">
                    <Money paise={c.finalPaise} />
                    {c.key !== "yours" ? (
                      <span className="ml-2 text-xs">
                        <SignedFigure paise={-diff} /> vs yours
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-wows-muted">
                        {c.note}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-wows-muted">
            You beat doing nothing and trailed the index. Read on for why; the
            gap is almost entirely two decisions.
          </p>
        </div>
      </section>

      <Section title="What showed up">
        <div className="grid gap-4 md:grid-cols-2">
          {debrief.behaviours.map((b) => (
            <Panel
              key={b.key}
              tone={b.severity === "good" ? "surface" : "accent"}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold text-wows-ink">{b.label}</h3>
                <span
                  className={cn(
                    "text-sm font-medium",
                    b.severity === "good"
                      ? "text-wows-positive"
                      : "text-wows-accent",
                  )}
                >
                  {b.verdict}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-wows-ink">
                {b.detail}
              </p>
              <p className="mt-2 text-sm">
                <span className="text-wows-muted">
                  Effect on final corpus:{" "}
                </span>
                <SignedFigure paise={b.costPaise} />
              </p>
            </Panel>
          ))}
        </div>
      </Section>

      <Section title="Decision timeline">
        <TableWrap>
          <thead>
            <tr>
              <th scope="col" className={cn(th, "w-28")}>
                Date
              </th>
              <th scope="col" className={cn(thNum, "w-12")}>
                Step
              </th>
              <th scope="col" className={th}>
                Action
              </th>
              <th scope="col" className={cn(th, "hidden md:table-cell")}>
                Your reason at the time
              </th>
              <th scope="col" className={thNum}>
                Corpus
              </th>
              <th scope="col" className={cn(th, "w-28 pr-0")}>
                Flag
              </th>
            </tr>
          </thead>
          <tbody>
            {debrief.timeline.map((t) => (
              <tr key={t.step}>
                <td
                  className={cn(
                    td,
                    "numeric whitespace-nowrap text-wows-muted",
                  )}
                >
                  <When iso={t.date} withTime={false} />
                </td>
                <td className={tdNum}>{t.step}</td>
                <td className={td}>
                  {t.action}
                  <span className="block text-xs text-wows-muted md:hidden">
                    {t.reason}
                  </span>
                </td>
                <td className={cn(td, "hidden text-wows-muted md:table-cell")}>
                  {t.reason}
                </td>
                <td className={tdNum}>
                  <Money paise={t.corpusPaise} />
                </td>
                <td className={cn(td, "pr-0 text-xs")}>
                  {t.flag ? (
                    <span className={FLAG[t.flag].tone}>
                      {FLAG[t.flag].label}
                    </span>
                  ) : (
                    <span className="text-wows-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Section>

      <Section title="What to try next run">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-wows-ink">
          <li>
            Write the rule for changing the mix before step 1, and only change
            it when the rule fires.
          </li>
          <li>
            Cap any single class at 40% unless your written reason names what
            would make you cut it.
          </li>
          <li>
            When a week feels bad, do nothing that week and revisit the next.
            Most of your reversals happened within two steps.
          </li>
        </ol>
      </Section>
    </main>
  );
}
