"use client";

import { useState } from "react";
import type { DebriefView } from "@/lib/runs/debrief-data";

/**
 * Everything behind the headline, collapsed by default.
 *
 * Every rank and every number the club shows has to be explainable to its
 * components (H23), which means the working has to be available, not that it
 * has to be on the first screen. Collapsed, but present and complete.
 */
function rupees(paise: string): string {
  const value = BigInt(paise);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = (abs / 100n).toString();
  const grouped =
    whole.length <= 3
      ? whole
      : `${whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${whole.slice(-3)}`;
  return `${negative ? "−" : ""}₹${grouped}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-wows-rule">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between py-3 text-left text-[15px] font-medium text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
      >
        {title}
        <span aria-hidden="true" className="text-wows-muted">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}

export function DebriefDisclosure({ view }: { view: DebriefView }) {
  const { metrics } = view;
  return (
    <section className="mt-10 border-t border-wows-rule pt-2">
      <h2 className="py-3 text-[17px] font-semibold text-wows-ink">
        The working
      </h2>

      <Section title="How this finding was chosen">
        <p className="max-w-prose text-[15px] leading-relaxed text-wows-muted">
          Three metrics are computed and compared with a stated benchmark. The
          one furthest past its benchmark, measured as a fraction of it, is the
          one shown; ties break in a fixed order. If none is past its benchmark,
          that is said rather than a finding being manufactured.
        </p>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          {view.finding.method}
        </p>
      </Section>

      <Section title="All three behavioural metrics">
        <dl className="grid gap-3 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-wows-muted">Turnover after the opening</dt>
            <dd className="numeric text-wows-ink">
              {rupees(String(metrics.overTrading.turnoverPaise))} ·{" "}
              {(metrics.overTrading.turnoverBps / 100).toFixed(1)}% of average
              value
            </dd>
          </div>
          <div>
            <dt className="text-wows-muted">Trades, and reversals</dt>
            <dd className="numeric text-wows-ink">
              {metrics.overTrading.tradeCount} trades,{" "}
              {metrics.overTrading.reversalCount} reversed within{" "}
              {metrics.overTrading.reversalWindowSteps} steps
            </dd>
          </div>
          <div>
            <dt className="text-wows-muted">Transaction costs paid</dt>
            <dd className="numeric text-wows-ink">
              {rupees(String(metrics.overTrading.costPaise))}
            </dd>
          </div>
          <div>
            <dt className="text-wows-muted">Selling into a drawdown</dt>
            <dd className="numeric text-wows-ink">
              {metrics.panicSelling.episodes.length} month
              {metrics.panicSelling.episodes.length === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="text-wows-muted">Largest holding, at its peak</dt>
            <dd className="numeric text-wows-ink">
              {(metrics.concentration.peakBps / 100).toFixed(1)}%
              {metrics.concentration.peakSymbol
                ? ` in ${metrics.concentration.peakSymbol}`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-wows-muted">Largest holding, on average</dt>
            <dd className="numeric text-wows-ink">
              {(metrics.concentration.timeWeightedMaxBps / 100).toFixed(1)}%
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="How the comparisons were built">
        <p className="max-w-prose text-[15px] leading-relaxed text-wows-muted">
          <strong className="font-medium text-wows-ink">Did nothing</strong>{" "}
          takes the allocation you opened with, deploys it once at the first
          step, and never trades again. It is your opening weights, not your
          latest ones, so it is genuinely the portfolio you would have had by
          leaving it alone.
        </p>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          <strong className="font-medium text-wows-ink">All index</strong> puts
          the whole starting corpus into the scenario&apos;s benchmark at the
          first step and holds it. Both receive exactly the income, expenses and
          unplanned expense that you did, and both pay the same 0.10% per trade,
          so the only difference between the three numbers is what was decided.
        </p>
      </Section>

      <Section title={`Every trade (${view.trades.length})`}>
        {view.trades.length === 0 ? (
          <p className="text-[15px] text-wows-muted">
            You made no trades at all. The opening allocation stood for the
            whole run.
          </p>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-wows-ink/60 text-left text-wows-muted">
                  <th className="py-1.5 pr-3 font-medium">Step</th>
                  <th className="py-1.5 pr-3 font-medium">Date</th>
                  <th className="py-1.5 pr-3 font-medium">Instrument</th>
                  <th className="py-1.5 pr-3 font-medium">Side</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Value</th>
                  <th className="py-1.5 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {view.trades.map((trade, index) => (
                  <tr
                    key={`${trade.step}-${trade.symbol}-${index}`}
                    className="border-b border-wows-rule"
                  >
                    <td className="numeric py-1.5 pr-3">{trade.step}</td>
                    <td className="numeric py-1.5 pr-3 text-wows-muted">
                      {trade.date}
                    </td>
                    <td className="py-1.5 pr-3">{trade.symbol}</td>
                    <td className="py-1.5 pr-3">{trade.side}</td>
                    <td className="numeric py-1.5 pr-3 text-right">
                      {rupees(trade.grossPaise)}
                    </td>
                    <td className="numeric py-1.5 text-right text-wows-muted">
                      {rupees(trade.costPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Where these prices came from">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[15px]">
          <dt className="text-wows-muted">Basis</dt>
          <dd className="text-wows-ink">{view.priceBasis.basis}</dd>
          <dt className="text-wows-muted">Dividends included</dt>
          <dd className="text-wows-ink">
            {view.priceBasis.dividendsIncluded ? "yes" : "no"}
          </dd>
          <dt className="text-wows-muted">Adjusted as of</dt>
          <dd className="numeric text-wows-ink">
            {view.priceBasis.adjustedAsOf}
          </dd>
          <dt className="text-wows-muted">Carried-forward closes used</dt>
          <dd className="text-wows-ink">
            {view.priceBasis.usedSyntheticPrices ? "yes" : "no"}
          </dd>
        </dl>
      </Section>
    </section>
  );
}
