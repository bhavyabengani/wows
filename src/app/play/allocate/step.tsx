"use client";

import { Slider } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import {
  DisplayMoney,
  Money,
  Section,
  SignedFigure,
  Sparkline,
  StepStrip,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { allocation } from "@/preview-data";

const TONE: Record<string, { fill: string; label: string }> = {
  nifty: { fill: "var(--wows-accent)", label: "oxblood" },
  largecap: { fill: "var(--wows-accent-soft)", label: "oxblood, light" },
  gilt: { fill: "var(--wows-positive)", label: "green" },
  gold: { fill: "#6E8F7C", label: "green, light" },
  fd: { fill: "url(#hatch)", label: "hatched" },
};

/** Counts a bigint of paise from the previous value to `target` over ~400ms; a single frame under reduced motion. */
function useCountUp(target: bigint) {
  const [shown, setShown] = useState(target);
  const previous = useRef(target);
  useEffect(() => {
    const from = previous.current;
    previous.current = target;
    if (from === target) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduce ? 0 : 400;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(
        from + ((target - from) * BigInt(Math.round(eased * 1000))) / 1000n,
      );
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

export function AllocationStep() {
  const [weights, setWeights] = useState(() =>
    Object.fromEntries(allocation.classes.map((c) => [c.key, c.pct])),
  );
  const [advanced, setAdvanced] = useState(false);
  const step = advanced ? allocation.step + 1 : allocation.step;
  const corpus = useCountUp(
    advanced ? allocation.nextCorpusPaise : allocation.corpusPaise,
  );
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const balanced = total === 100;
  const net = [...allocation.income, ...allocation.expenses].reduce(
    (a, l) => a + l.paise,
    0n,
  );
  const history = advanced
    ? [...allocation.history, Number(allocation.nextCorpusPaise / 100n)]
    : allocation.history;

  return (
    <div className="flex flex-col gap-10">
      {/* Cockpit header: date and value dominant */}
      <section className="grid gap-6 border-t border-wows-ink pt-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-12">
          <div>
            <p className="text-[15px] text-wows-muted">Replay date</p>
            <p className="numeric mt-1 text-[28px] leading-none font-medium tracking-tight text-wows-ink sm:text-[34px]">
              <When
                iso={advanced ? "2024-04-10T09:45:00Z" : allocation.replayDate}
                withTime={false}
              />
            </p>
            <p className="numeric mt-2 text-[12.5px] text-wows-muted">
              {allocation.scenario}
            </p>
          </div>
          <div>
            <p className="text-[15px] text-wows-muted">Portfolio value</p>
            <p className="mt-1">
              <DisplayMoney paise={corpus} />
            </p>
            <p className="mt-2 text-[15px]">
              <SignedFigure
                bps={advanced ? 61 : allocation.changeSinceLastBps}
              />{" "}
              <span className="text-wows-muted">this step · </span>
              <SignedFigure paise={corpus - allocation.startPaise} />{" "}
              <span className="text-wows-muted">since start</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <Sparkline values={history} width={220} height={48} tone="ink" />
          <StepStrip steps={allocation.steps} current={step} />
          <p className="numeric text-[12.5px] text-wows-muted">
            step {step} of {allocation.steps}
          </p>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-8">
          <Section title="Allocation for the coming week">
            <AllocationBar weights={weights} />
            <div className="mt-6 flex flex-col divide-y divide-wows-rule">
              {allocation.classes.map((c) => {
                const w = weights[c.key] ?? 0;
                return (
                  <div
                    key={c.key}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_11rem_5.5rem]"
                  >
                    <label
                      htmlFor={`w-${c.key}`}
                      className="flex items-center gap-2 text-[15px] text-wows-ink"
                    >
                      <Swatch fill={TONE[c.key]!.fill} />
                      <span>
                        {c.label}
                        <span className="numeric ml-2 text-[12.5px] text-wows-muted">
                          <Money paise={c.valuePaise} />{" "}
                          <SignedFigure bps={c.changeBps} />
                        </span>
                      </span>
                    </label>
                    <Slider.Root
                      className="relative col-span-2 flex h-5 w-full touch-none items-center select-none sm:col-span-1"
                      value={[w]}
                      max={100}
                      step={5}
                      onValueChange={([v]) =>
                        setWeights((s) => ({ ...s, [c.key]: v ?? 0 }))
                      }
                      aria-label={`${c.label} weight`}
                    >
                      <Slider.Track className="relative h-1 grow bg-wows-rule">
                        <Slider.Range className="absolute h-full bg-wows-ink" />
                      </Slider.Track>
                      <Slider.Thumb className="block h-4 w-2.5 bg-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft" />
                    </Slider.Root>
                    <div className="flex items-center justify-end gap-1 sm:col-start-3 sm:row-start-1">
                      <input
                        id={`w-${c.key}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        step={5}
                        value={w}
                        onChange={(e) =>
                          setWeights((s) => ({
                            ...s,
                            [c.key]: Number(e.target.value),
                          }))
                        }
                        className="numeric w-16 border border-wows-rule bg-wows-surface px-2 py-1 text-right text-[15px] text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
                      />
                      <span className="text-[15px] text-wows-muted">%</span>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-3 text-[15px]">
                <span className="text-wows-muted">Total</span>
                <span
                  className={cn(
                    "numeric font-medium",
                    balanced ? "text-wows-ink" : "text-wows-accent",
                  )}
                >
                  {total}%{balanced ? "" : " · must be 100%"}
                </span>
              </div>
            </div>
          </Section>

          <Section title="This week's cash">
            <dl className="divide-y divide-wows-rule text-[15px]">
              {[...allocation.income, ...allocation.expenses].map((l) => (
                <div
                  key={l.label}
                  className="flex items-baseline justify-between py-2"
                >
                  <dt className="text-wows-ink">{l.label}</dt>
                  <dd>
                    <SignedFigure paise={l.paise} />
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-2 font-medium">
                <dt className="text-wows-ink">
                  Net, applied to cash before the mix
                </dt>
                <dd>
                  <SignedFigure paise={net} />
                </dd>
              </div>
            </dl>
          </Section>
        </div>

        <div className="flex flex-col gap-8">
          <article className="border-l-[3px] border-wows-accent pl-4">
            <p className="numeric text-[12.5px] text-wows-muted">
              {allocation.news.dateline} · replay wire
            </p>
            <h2 className="mt-1 text-[20px] leading-snug font-semibold tracking-tight text-wows-ink">
              {allocation.news.headline}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-wows-ink">
              {allocation.news.body}
            </p>
            <p className="mt-2 text-[12.5px] text-wows-muted">
              {allocation.news.source}
            </p>
          </article>

          <div className="border-t border-wows-rule pt-4">
            {advanced ? (
              <div role="status">
                <p className="text-[15px] font-medium text-wows-ink">
                  Step {step} recorded
                </p>
                <p className="mt-1 text-[15px] text-wows-muted">
                  Saved on the server at <When iso="2026-09-08T12:54:00Z" />.
                  The next week&apos;s prices are in; nothing else moves in this
                  preview.
                </p>
                <button
                  type="button"
                  onClick={() => setAdvanced(false)}
                  className={`${buttonClass.quiet} mt-3 -ml-1`}
                >
                  Back to step {allocation.step}
                </button>
              </div>
            ) : (
              <>
                <p className="text-[15px] text-wows-ink">
                  Advancing applies this mix at Monday&apos;s open and replays
                  the week. You cannot go back.
                </p>
                <button
                  type="button"
                  disabled={!balanced}
                  onClick={() => setAdvanced(true)}
                  className={`${buttonClass.primary} mt-3 w-full`}
                >
                  Advance to step {allocation.step + 1}
                </button>
                {!balanced ? (
                  <p
                    className="mt-2 text-[12.5px] text-wows-accent"
                    role="alert"
                  >
                    Weights must total 100% before you can advance.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Swatch({ fill }: { fill: string }) {
  return (
    <svg width="14" height="14" aria-hidden="true" className="shrink-0">
      <rect width="14" height="14" fill={fill} />
    </svg>
  );
}

/** Single stacked bar, segmented by class; cash/FD hatched so it reads without colour. */
function AllocationBar({ weights }: { weights: Record<string, number> }) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const segments = allocation.classes.reduce<
    { key: string; x: number; w: number }[]
  >((acc, c) => {
    const x = acc.length ? acc[acc.length - 1]!.x + acc[acc.length - 1]!.w : 0;
    acc.push({ key: c.key, x, w: ((weights[c.key] ?? 0) / total) * 100 });
    return acc;
  }, []);
  return (
    <figure>
      <svg
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="h-10 w-full"
        role="img"
        aria-label="Allocation across asset classes"
      >
        <defs>
          <pattern
            id="hatch"
            width="1.5"
            height="1.5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="1.5" height="1.5" fill="var(--wows-surface)" />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="1.5"
              stroke="var(--wows-ink)"
              strokeWidth="0.6"
            />
          </pattern>
        </defs>
        <rect width="100" height="10" fill="var(--wows-rule)" />
        {segments.map((seg) => (
          <rect
            key={seg.key}
            x={seg.x}
            y={0}
            width={Math.max(0, seg.w - 0.3)}
            height={10}
            fill={TONE[seg.key]!.fill}
          />
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-wows-muted">
        {allocation.classes.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5">
            <Swatch fill={TONE[c.key]!.fill} />
            <span className="numeric text-wows-ink">
              {weights[c.key] ?? 0}%
            </span>{" "}
            {c.label.split(" (")[0]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
