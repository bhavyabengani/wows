import Link from "next/link";
import { cn } from "cn";
import {
  DisplayMoney,
  Money,
  PageHeader,
  Section,
  SignedFigure,
  SimulationDisclaimer,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { debrief } from "@/preview-data";

export const metadata = { title: "Debrief" };

const FLAG: Record<
  NonNullable<(typeof debrief.timeline)[number]["flag"]>,
  { label: string; tone: string; dot: string }
> = {
  "over-trading": {
    label: "Over-trading",
    tone: "text-wows-accent",
    dot: "bg-wows-accent",
  },
  panic: { label: "Panic", tone: "text-wows-accent", dot: "bg-wows-accent" },
  concentration: {
    label: "Concentration",
    tone: "text-wows-accent",
    dot: "bg-wows-accent-soft",
  },
  good: {
    label: "Held to plan",
    tone: "text-wows-positive",
    dot: "bg-wows-positive",
  },
};

export default function DebriefPage() {
  const yours = debrief.counterfactuals[0]!;
  return (
    <main className="flex flex-col gap-10">
      <PageHeader
        title="Debrief: 2024 H1 replay"
        lede="The run is over. This page is the point of the game: what you did, what doing nothing would have done, and the habits that showed up."
        aside={
          <Link href="/play/allocate" className={buttonClass.quiet}>
            Back to the game
          </Link>
        }
      />
      <SimulationDisclaimer />

      {/* Three large numbers in a row */}
      <section className="grid gap-6 border-t border-wows-ink pt-5 sm:grid-cols-3 sm:gap-8">
        {debrief.counterfactuals.map((c) => {
          const diff = c.finalPaise - yours.finalPaise;
          return (
            <div
              key={c.key}
              className={cn(
                "sm:border-l sm:border-wows-rule sm:pl-6 sm:first:border-l-0 sm:first:pl-0",
              )}
            >
              <p
                className={cn(
                  "text-[15px]",
                  c.key === "yours"
                    ? "font-semibold text-wows-ink"
                    : "text-wows-muted",
                )}
              >
                {c.label}
              </p>
              <p className="mt-2">
                <DisplayMoney paise={c.finalPaise} size="md" />
              </p>
              <p className="mt-2 text-[12.5px]">
                {c.key === "yours" ? (
                  <>
                    <SignedFigure paise={c.finalPaise - debrief.startPaise} />{" "}
                    <span className="text-wows-muted">
                      on <Money paise={debrief.startPaise} /> · {c.note}
                    </span>
                  </>
                ) : (
                  <>
                    <SignedFigure paise={-diff} />{" "}
                    <span className="text-wows-muted">
                      yours vs this · {c.note}
                    </span>
                  </>
                )}
              </p>
            </div>
          );
        })}
      </section>
      <p className="-mt-6 max-w-prose text-[15px] leading-relaxed text-wows-ink">
        You beat doing nothing and trailed the index. The gap is almost entirely
        two decisions, both below.
      </p>

      {/* Behaviours as short paragraphs with a leading oxblood keyword */}
      <Section title="What showed up">
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          {debrief.behaviours.map((b) => (
            <p
              key={b.key}
              className="max-w-prose text-[15px] leading-relaxed text-wows-ink"
            >
              <span
                className={cn(
                  "font-semibold",
                  b.severity === "good"
                    ? "text-wows-positive"
                    : "text-wows-accent",
                )}
              >
                {b.label}, {b.verdict.toLowerCase()}.
              </span>{" "}
              {b.detail}{" "}
              <span className="numeric whitespace-nowrap text-[12.5px]">
                <SignedFigure paise={b.costPaise} /> on the final corpus.
              </span>
            </p>
          ))}
        </div>
      </Section>

      {/* Timeline as a vertical rule with pinned events */}
      <Section title="Decision timeline">
        <ol className="relative ml-2 border-l border-wows-ink/60 pl-6">
          {debrief.timeline.map((t) => (
            <li key={t.step} className="relative pb-6 last:pb-0">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1.5 -left-[31px] size-2.5 rounded-full",
                  t.flag ? FLAG[t.flag].dot : "bg-wows-ink",
                )}
              />
              <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-[9rem_1fr_auto]">
                <p className="numeric text-[12.5px] text-wows-muted">
                  <When iso={t.date} withTime={false} /> · step {t.step}
                </p>
                <div>
                  <p className="text-[15px] font-medium text-wows-ink">
                    {t.action}
                  </p>
                  {t.reason ? (
                    <p className="text-[15px] text-wows-muted">
                      &ldquo;{t.reason}&rdquo;
                    </p>
                  ) : null}
                  {t.flag ? (
                    <p
                      className={cn(
                        "mt-0.5 text-[12.5px] font-medium",
                        FLAG[t.flag].tone,
                      )}
                    >
                      {FLAG[t.flag].label}
                    </p>
                  ) : null}
                </div>
                <p className="numeric text-[15px] text-wows-ink sm:text-right">
                  <Money paise={t.corpusPaise} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="What to try next run">
        <ol className="max-w-prose list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-wows-ink marker:text-wows-accent">
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
