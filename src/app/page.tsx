import Link from "next/link";
import { buttonClass, Panel } from "@/components/preview/ui";

export default function LandingPage() {
  const four = [
    {
      title: "Play a historical replay",
      body: "Allocate a student-sized corpus across index, large-caps, gilts, gold and FDs, one week at a time, through a real stretch of market history. Then read the debrief: what you did, what doing nothing would have done, and why.",
    },
    {
      title: "Forecast, and find out how calibrated you are",
      body: "Answer observable questions with a probability. When they resolve, the portal scores you on calibration, not on whether you called the market.",
    },
    {
      title: "Write research that gets reviewed",
      body: "Notes with a thesis, a key risk, a falsifier and sources. A vertical lead and a second reviewer score the reasoning. Published notes carry the club's educational disclaimer.",
    },
    {
      title: "Learn in tracks, meet in person",
      body: "Foundations, Applied Analysis and Quant modules with faculty-approved content, plus sessions, guest talks and workshops with RSVPs.",
    },
  ];
  return (
    <main className="flex flex-col gap-12">
      <section className="grid gap-8 md:grid-cols-[3fr_2fr] md:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-wows-ink sm:text-4xl">
            Wolves of Wall Street
          </h1>
          <p className="mt-3 max-w-xl text-lg text-wows-ink">
            Ashoka University&apos;s student finance club. We practise reasoning
            about markets with simulated money, written theses and forecasts
            that get scored.
          </p>
          <p className="mt-3 max-w-xl text-sm text-wows-muted">
            Members are assessed on the quality of their thinking, never on
            returns. Every season is a semester; every result is explainable.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="#apply" className={buttonClass.primary}>
              Apply for Monsoon 2026
            </Link>
            <Link href="/research" className={buttonClass.secondary}>
              Read published research
            </Link>
          </div>
        </div>
        <Panel>
          <h2 className="text-sm font-semibold text-wows-ink">
            What we do not do
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-wows-ink">
            No real money, ever: no payments, brokerage links, wallets or
            prizes. No buy, sell or hold recommendations under the club&apos;s
            name. Nothing on this portal is investment advice. Members&apos;
            positions are never shown as suggestions, and there is no list of
            &ldquo;top picks&rdquo;.
          </p>
          <p className="mt-2 text-xs text-wows-muted">
            This is a written commitment to the university and a design rule of
            the portal.
          </p>
        </Panel>
      </section>

      <section
        aria-labelledby="four"
        className="border-t border-wows-rule pt-6"
      >
        <h2 id="four" className="text-base font-semibold text-wows-ink">
          Four things the portal does
        </h2>
        <ol className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {four.map((item, i) => (
            <li key={item.title} className="flex gap-4">
              <span className="numeric mt-0.5 w-6 shrink-0 text-sm text-wows-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-medium text-wows-ink">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-wows-muted">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-8 border-t border-wows-rule pt-6 md:grid-cols-2">
        <div>
          <h2 className="text-base font-semibold text-wows-ink">
            Faculty oversight
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-wows-muted">
            A faculty advisor from the Department of Economics reviews the
            curriculum before it is published and can read everything on the
            portal. Member-authored content that becomes club-visible passes
            through a review state first. Admin actions are logged and the log
            is visible in-app.
          </p>
        </div>
        <div id="apply">
          <h2 className="text-base font-semibold text-wows-ink">Apply</h2>
          <p className="mt-2 text-sm leading-relaxed text-wows-muted">
            Open to all Ashoka undergraduates. Sign in with your Ashoka email,
            write a short statement, and the core team will get back to you
            within a week. New members start in Foundations.
          </p>
          <Link href="#" className={`${buttonClass.primary} mt-4`}>
            Start an application
          </Link>
        </div>
      </section>
    </main>
  );
}
