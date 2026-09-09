"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RunView } from "@/lib/runs/view";
import { formatInIST } from "@/lib/time";

/**
 * The run screen: one timestep at a time.
 *
 * Deliberately unremarkable. The brief puts the effort into the debrief, and a
 * trading screen that draws attention to itself is a trading screen teaching
 * the wrong thing.
 *
 * Two rules shape the mechanics here. Nothing is optimistic: the portfolio
 * shown is always the one the server last confirmed, and advancing waits.
 * Nothing fails silently: every rejected action puts a sentence and a next
 * step on the screen (H34).
 */

const CASH = "CASH";

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

/** Colour is never the only signal: sign and arrow always travel with it (H38). */
function Signed({ paise }: { paise: bigint }) {
  const sign = paise > 0n ? 1 : paise < 0n ? -1 : 0;
  const arrow = sign > 0 ? "▲" : sign < 0 ? "▼" : "—";
  const tone =
    sign > 0
      ? "text-wows-positive"
      : sign < 0
        ? "text-wows-accent"
        : "text-wows-muted";
  const word = sign > 0 ? "up" : sign < 0 ? "down" : "unchanged";
  return (
    <span className={`numeric whitespace-nowrap ${tone}`}>
      <span aria-hidden="true">{arrow} </span>
      <span className="sr-only">{word} </span>
      {sign > 0 ? "+" : ""}
      {rupees(String(paise), { paise: true })}
    </span>
  );
}

function weightsFromView(view: RunView): Record<string, number> {
  if (view.targetWeightsBps !== null) return { ...view.targetWeightsBps };
  const even = Math.floor(10_000 / (view.universe.length + 1));
  const weights: Record<string, number> = {};
  for (const symbol of view.universe) weights[symbol] = 0;
  weights[CASH] = 10_000 - even * 0;
  return weights;
}

export function AllocateScreen({ initial }: { initial: RunView }) {
  const router = useRouter();
  const [view, setView] = useState<RunView>(initial);
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    weightsFromView(initial),
  );
  const [busy, setBusy] = useState<"advance" | "rebalance" | null>(null);
  const [problem, setProblem] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  const total = useMemo(
    () => Object.values(weights).reduce((sum, w) => sum + w, 0),
    [weights],
  );
  const residual = 10_000 - total;
  const balanced = residual === 0;
  const finished = view.status === "completed";

  const gain = BigInt(view.totalValuePaise) - BigInt(view.startingCorpusPaise);

  async function post(
    path: string,
    body: Record<string, unknown>,
    kind: "advance" | "rebalance",
  ) {
    setBusy(kind);
    setProblem(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as Partial<RunView> & {
        error?: string;
        detail?: string;
      };
      if (!response.ok || payload.runId === undefined) {
        setProblem({
          title: payload.error ?? "That did not go through",
          detail:
            payload.detail ??
            "Nothing changed. Your run is still where it was; try again.",
        });
        return;
      }
      // Only ever render what the server confirmed. No optimistic state.
      const next = payload as RunView;
      setView(next);
      setWeights(weightsFromView(next));
      if (next.status === "completed") {
        router.push(`/play/allocate/debrief?run=${next.runId}`);
      }
    } catch {
      setProblem({
        title: "The server could not be reached",
        detail:
          "Nothing was saved. Your run is safe at the step you were on; try again when you are back online.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-wows-ink">
          {view.scenarioName}
        </h1>
        <span
          data-testid="run-mode"
          className={`border px-2 py-0.5 text-xs font-medium ${
            view.mode === "ranked"
              ? "border-wows-accent bg-wows-accent text-wows-paper"
              : "border-wows-rule text-wows-muted"
          }`}
        >
          {view.mode === "ranked" ? "Ranked attempt" : "Practice, not ranked"}
        </span>
      </div>

      {/* The educational disclaimer belongs inside the simulation, not only in
          the footer. This is a written commitment to the university. */}
      <p
        role="note"
        className="mt-4 border-l-2 border-wows-rule pl-3 text-[13px] leading-relaxed text-wows-muted"
      >
        Simulation. Historical replay on a pinned data snapshot; no real money,
        no live prices, and nothing here is advice. You are being assessed on
        your reasoning, not your returns.
      </p>

      <section className="mt-8 grid gap-6 border-t border-wows-ink pt-5 sm:grid-cols-[auto_1fr]">
        <div>
          <p className="text-[13px] text-wows-muted">Replay date</p>
          <p
            data-testid="replay-date"
            className="numeric mt-1 text-[26px] leading-none font-medium tracking-tight text-wows-ink"
          >
            {formatInIST(`${view.date}T00:00:00Z`, { withTime: false })}
          </p>
          <p className="numeric mt-2 text-[13px] text-wows-muted">
            step <span data-testid="run-step">{view.step}</span> of{" "}
            {view.totalSteps - 1}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-[13px] text-wows-muted">Portfolio value</p>
          <p
            data-testid="portfolio-value"
            className="numeric mt-1 text-[34px] leading-none font-medium tracking-tight text-wows-ink"
          >
            {rupees(view.totalValuePaise, { paise: true })}
          </p>
          <p className="mt-2 text-[15px]">
            <Signed paise={gain} />{" "}
            <span className="text-wows-muted">since you started</span>
          </p>
          <p className="numeric mt-1 text-[13px] text-wows-muted">
            cash {rupees(view.cashPaise, { paise: true })}
          </p>
        </div>
      </section>

      {view.news ? (
        <article className="mt-8 border-l-[3px] border-wows-accent pl-4">
          <p className="numeric text-[12.5px] text-wows-muted">
            {view.news.dateline}
          </p>
          <h2 className="mt-1 text-[18px] leading-snug font-semibold text-wows-ink">
            {view.news.headline}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-wows-ink">
            {view.news.body}
          </p>
          <p className="mt-2 text-[12.5px] text-wows-muted">
            {view.news.source}
          </p>
        </article>
      ) : null}

      {view.stepFlows.length > 0 ? (
        <section className="mt-8 border-t border-wows-rule pt-4">
          <h2 className="text-[17px] font-semibold text-wows-ink">
            This month&apos;s cash
          </h2>
          <dl className="mt-2 divide-y divide-wows-rule text-[15px]">
            {view.stepFlows.map((flow, index) => (
              <div
                key={`${flow.kind}-${index}`}
                className="flex items-baseline justify-between py-2"
              >
                <dt className="text-wows-ink">{flow.label}</dt>
                <dd>
                  <Signed paise={BigInt(flow.amountPaise)} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-8 border-t border-wows-rule pt-4">
        <h2 className="text-[17px] font-semibold text-wows-ink">
          Your allocation
        </h2>
        <p className="mt-1 text-[13px] text-wows-muted">
          Set a target for each holding. Weights must total 100%; the server
          works out the trades and charges 0.10% on each one.
        </p>

        <div className="mt-4 flex flex-col divide-y divide-wows-rule">
          {[...view.universe, CASH].map((symbol) => {
            const quote = view.quotes.find((q) => q.symbol === symbol);
            const position = view.positions.find((p) => p.symbol === symbol);
            const weight = weights[symbol] ?? 0;
            return (
              <div
                key={symbol}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_5.5rem]"
              >
                <label
                  htmlFor={`w-${symbol}`}
                  className="text-[15px] text-wows-ink"
                >
                  {symbol}
                  {quote ? (
                    <span className="numeric ml-2 text-[12.5px] text-wows-muted">
                      {rupees(quote.closePaise, { paise: true })}
                      {quote.synthetic ? (
                        <span title={`Carried forward from ${quote.asOfDate}`}>
                          {" "}
                          (carried forward)
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {position ? (
                    <span className="numeric ml-2 text-[12.5px] text-wows-muted">
                      holding {rupees(position.valuePaise)}
                    </span>
                  ) : null}
                </label>
                <input
                  type="range"
                  min={0}
                  max={10_000}
                  step={100}
                  value={weight}
                  disabled={finished}
                  aria-label={`${symbol} target weight`}
                  onChange={(event) =>
                    setWeights((current) => ({
                      ...current,
                      [symbol]: Number(event.target.value),
                    }))
                  }
                  className="col-span-2 w-full accent-wows-accent sm:col-span-1"
                />
                <div className="flex items-center justify-end gap-1 sm:col-start-3 sm:row-start-1">
                  <input
                    id={`w-${symbol}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(weight / 100)}
                    disabled={finished}
                    onChange={(event) =>
                      setWeights((current) => ({
                        ...current,
                        [symbol]: Math.round(Number(event.target.value) * 100),
                      }))
                    }
                    className="numeric w-16 border border-wows-rule bg-wows-surface px-2 py-1 text-right text-[15px] text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
                  />
                  <span className="text-[15px] text-wows-muted">%</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-3 text-[15px]">
          <span className="text-wows-muted">Total</span>
          <span
            data-testid="weight-total"
            className={`numeric font-medium ${balanced ? "text-wows-ink" : "text-wows-accent"}`}
          >
            {(total / 100).toFixed(0)}%
            {balanced
              ? ""
              : ` · ${residual > 0 ? "add" : "remove"} ${Math.abs(residual / 100).toFixed(0)}%`}
          </span>
        </div>

        <button
          type="button"
          disabled={!balanced || busy !== null || finished}
          data-testid="rebalance"
          onClick={() =>
            void post(
              `/api/play/runs/${view.runId}/rebalance`,
              {
                idempotencyKey: `rebalance-${view.runId}-${view.step}-${total}`,
                weightsBps: weights,
              },
              "rebalance",
            )
          }
          className="mt-4 inline-flex items-center justify-center border border-wows-ink px-4 py-2 text-sm font-semibold text-wows-ink hover:bg-wows-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft disabled:opacity-50"
        >
          {busy === "rebalance" ? "Saving…" : "Apply this allocation"}
        </button>
      </section>

      {problem ? (
        <div
          role="alert"
          data-testid="run-error"
          className="mt-6 border-l-[3px] border-wows-accent bg-wows-surface p-4"
        >
          <p className="text-[15px] font-semibold text-wows-ink">
            {problem.title}
          </p>
          <p className="mt-1 text-[15px] text-wows-muted">{problem.detail}</p>
        </div>
      ) : null}

      <section className="mt-8 border-t border-wows-rule pt-4">
        {finished ? (
          <p className="text-[15px] text-wows-ink">
            The run is over. Your debrief is next.
          </p>
        ) : (
          <p className="text-[15px] text-wows-ink">
            Advancing applies your allocation at this month&apos;s close and
            replays the next month. You cannot go back.
          </p>
        )}
        <button
          type="button"
          disabled={busy !== null || finished}
          data-testid="advance"
          onClick={() =>
            void post(
              `/api/play/runs/${view.runId}/advance`,
              { idempotencyKey: `advance-${view.runId}-${view.step + 1}` },
              "advance",
            )
          }
          className="mt-3 inline-flex w-full items-center justify-center bg-wows-accent px-4 py-2.5 text-sm font-semibold text-wows-paper hover:bg-wows-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft disabled:opacity-50 sm:w-auto"
        >
          {busy === "advance"
            ? "Advancing…"
            : finished
              ? "Run complete"
              : `Advance to step ${view.step + 1}`}
        </button>
      </section>
    </main>
  );
}
