import Link from "next/link";
import { buttonClass } from "@/components/preview/ui";
import { landing } from "@/preview-data";

export default function LandingPage() {
  return (
    <main className="flex flex-col gap-14">
      <section className="relative max-w-4xl">
        {/* A live status line, in the data colour: the instrument is running. */}
        <p className="numeric mb-5 flex items-center gap-2.5 text-[11px] tracking-[0.2em] text-wows-data uppercase">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-wows-data opacity-70" />
            <span className="relative inline-flex size-1.5 rounded-full bg-wows-data" />
          </span>
          Monsoon 2026 · week 3 of 15 · season open
        </p>
        <h1 className="text-[40px] leading-[1.02] font-bold tracking-tight text-wows-ink sm:text-[64px]">
          Wolves of
          <br />
          <span className="figure-lit glow-text">Wall Street</span>
        </h1>
        <p className="mt-6 max-w-3xl text-[22px] leading-snug text-wows-ink sm:text-[28px]">
          Ashoka University&apos;s student finance club. We practise reasoning
          about markets with simulated money, written theses and forecasts that
          get scored.
        </p>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-wows-muted">
          Members are assessed on the quality of their thinking, never on
          returns. A season is a semester. Every rank on this portal can be
          taken apart into the numbers that made it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="#apply" className={buttonClass.primary}>
            Apply for Monsoon 2026
          </Link>
          <Link href="/research" className={buttonClass.secondary}>
            Read published research
          </Link>
        </div>
      </section>

      <section aria-labelledby="four" className="rule-lit border-t-2 pt-5">
        <h2
          id="four"
          className="text-xl font-semibold tracking-tight text-wows-ink"
        >
          Four things the portal does
        </h2>
        <ol className="mt-4 grid gap-x-10 divide-y divide-wows-rule sm:grid-cols-2 sm:divide-y-0">
          {landing.functions.map((item, i) => (
            <li
              key={item.title}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 py-5 sm:border-t sm:border-wows-rule"
            >
              <h3 className="text-[17px] font-semibold leading-snug text-wows-ink">
                <span className="numeric mr-2 text-wows-muted">0{i + 1}</span>
                {item.title}
              </h3>
              <p className="numeric figure-lit row-span-2 self-start text-right text-[32px] leading-none font-medium">
                {item.figure}
                <span className="mt-1 block max-w-[9rem] text-right font-sans text-[12.5px] leading-tight font-normal text-wows-muted">
                  {item.unit}
                </span>
              </p>
              <p className="text-[15px] leading-relaxed text-wows-muted">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="border-y border-wows-ink py-6"
        aria-label="Oversight and policy"
      >
        <div className="mx-auto grid max-w-4xl gap-6 text-center md:grid-cols-2 md:gap-10 md:text-left">
          <div>
            <p className="text-[12.5px] font-semibold text-wows-accent">
              Faculty oversight
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-wows-ink">
              {landing.masthead.faculty}
            </p>
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-wows-accent">
              No advice, no money
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-wows-ink">
              {landing.masthead.policy}
            </p>
          </div>
        </div>
      </section>

      <section id="apply" className="max-w-2xl">
        <h2 className="text-xl font-semibold tracking-tight text-wows-ink">
          Apply
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-wows-muted">
          Open to all Ashoka undergraduates. Sign in with your Ashoka email,
          write a short statement, and the core team replies within a week. New
          members start in Foundations.
        </p>
        <Link href="#" className={`${buttonClass.primary} mt-5`}>
          Start an application
        </Link>
      </section>
    </main>
  );
}
