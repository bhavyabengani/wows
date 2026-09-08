"use client";

import { Slider } from "radix-ui";
import { useState } from "react";
import { cn } from "cn";
import {
  Money,
  Panel,
  Section,
  SignedFigure,
  When,
  buttonClass,
  td,
  tdNum,
  th,
  thNum,
  TableWrap,
} from "@/components/preview/ui";
import { allocation } from "@/preview-data";

export function AllocationStep() {
  const [weights, setWeights] = useState(() =>
    Object.fromEntries(allocation.classes.map((c) => [c.key, c.pct])),
  );
  const [advanced, setAdvanced] = useState(false);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const balanced = total === 100;
  const net = [...allocation.income, ...allocation.expenses].reduce(
    (a, l) => a + l.paise,
    0n,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-wows-muted">Replay date</p>
            <p className="numeric text-lg font-semibold text-wows-ink">
              <When iso={allocation.replayDate} withTime={false} />
            </p>
            <p className="numeric text-xs text-wows-muted">
              {allocation.scenario}, step {allocation.step} of{" "}
              {allocation.steps}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-wows-muted">Portfolio value</p>
            <p className="numeric text-2xl font-semibold text-wows-ink">
              <Money paise={allocation.corpusPaise} />
            </p>
            <p className="text-xs">
              <SignedFigure bps={allocation.changeSinceLastBps} /> since last
              step,{" "}
              <SignedFigure
                paise={allocation.corpusPaise - allocation.startPaise}
              />{" "}
              since start
            </p>
          </div>
        </div>

        <Section title="Allocation for the coming week">
          <div className="flex flex-col gap-4">
            {allocation.classes.map((c) => {
              const w = weights[c.key] ?? 0;
              return (
                <div
                  key={c.key}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_10rem_4.5rem]"
                >
                  <label
                    htmlFor={`w-${c.key}`}
                    className="text-sm text-wows-ink sm:col-span-1"
                  >
                    {c.label}
                    <span className="ml-2 text-xs text-wows-muted">
                      <Money paise={c.valuePaise} /> ·{" "}
                      <SignedFigure bps={c.changeBps} />
                    </span>
                  </label>
                  <Slider.Root
                    className="relative col-span-2 flex h-5 w-full touch-none items-center select-none sm:col-span-1 sm:order-none"
                    value={[w]}
                    max={100}
                    step={5}
                    onValueChange={([v]) =>
                      setWeights((s) => ({ ...s, [c.key]: v ?? 0 }))
                    }
                    aria-label={`${c.label} weight`}
                  >
                    <Slider.Track className="relative h-1.5 grow rounded-full bg-wows-rule">
                      <Slider.Range className="absolute h-full rounded-full bg-wows-accent" />
                    </Slider.Track>
                    <Slider.Thumb className="block size-4 rounded-full border border-wows-accent bg-wows-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft" />
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
                      className="numeric w-16 rounded-md border border-wows-rule bg-wows-surface px-2 py-1 text-right text-sm text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
                    />
                    <span className="text-sm text-wows-muted">%</span>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-wows-rule pt-3 text-sm">
              <span className="text-wows-muted">Total</span>
              <span
                className={cn(
                  "numeric font-medium",
                  balanced ? "text-wows-ink" : "text-wows-accent",
                )}
              >
                {total}%{balanced ? "" : ` (must be 100%)`}
              </span>
            </div>
          </div>
        </Section>

        <Section title="This week's cash">
          <TableWrap>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Line
                </th>
                <th scope="col" className={thNum}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {[...allocation.income, ...allocation.expenses].map((l) => (
                <tr key={l.label}>
                  <td className={td}>{l.label}</td>
                  <td className={tdNum}>
                    <SignedFigure paise={l.paise} />
                  </td>
                </tr>
              ))}
              <tr>
                <td className={cn(td, "font-medium")}>
                  Net, applied to cash before the mix
                </td>
                <td className={cn(tdNum, "font-medium")}>
                  <SignedFigure paise={net} />
                </td>
              </tr>
            </tbody>
          </TableWrap>
        </Section>
      </div>

      <div className="flex flex-col gap-6">
        <Panel>
          <p className="text-xs text-wows-muted">
            {allocation.news.dateline} · replay wire
          </p>
          <h2 className="mt-1 font-semibold leading-snug text-wows-ink">
            {allocation.news.headline}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-wows-ink">
            {allocation.news.body}
          </p>
          <p className="mt-2 text-xs text-wows-muted">
            {allocation.news.source}
          </p>
        </Panel>

        <Panel tone="accent">
          {advanced ? (
            <div role="status">
              <p className="font-medium text-wows-ink">
                Step {allocation.step + 1} recorded
              </p>
              <p className="mt-1 text-sm text-wows-muted">
                Saved on the server at <When iso="2026-09-08T12:54:00Z" />. In
                the real game the next week&apos;s prices load now; in this
                preview nothing moves.
              </p>
              <button
                type="button"
                onClick={() => setAdvanced(false)}
                className={`${buttonClass.secondary} mt-3`}
              >
                Back
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-wows-ink">
                Advancing applies this mix at Monday&apos;s open and replays the
                week. You cannot go back.
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
                <p className="mt-2 text-xs text-wows-accent" role="alert">
                  Weights must total 100% before you can advance.
                </p>
              ) : null}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
