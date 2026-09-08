"use client";

import { useState } from "react";
import { cn } from "cn";
import {
  Chip,
  Panel,
  Section,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { forecastQuestions, type ForecastQuestion } from "@/preview-data";

export function ForecastList() {
  return (
    <Section title="Questions this season">
      <ul className="flex flex-col gap-3">
        {forecastQuestions.map((q) => (
          <QuestionCard key={q.id} q={q} defaultOpen={q.id === "q1"} />
        ))}
      </ul>
    </Section>
  );
}

function QuestionCard({
  q,
  defaultOpen,
}: {
  q: ForecastQuestion;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [probability, setProbability] = useState(q.probability ?? 50);
  const [rationale, setRationale] = useState(q.rationale ?? "");
  const [submitted, setSubmitted] = useState(q.state === "submitted");
  const locked = q.state === "locked";

  return (
    <li>
      <Panel className={cn(locked && "bg-wows-paper")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="text-left font-medium leading-snug text-wows-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
          >
            {q.prompt}
          </button>
          {locked ? (
            <Chip>Locked</Chip>
          ) : submitted ? (
            <Chip tone="positive">Submitted</Chip>
          ) : (
            <Chip tone="accent">Open</Chip>
          )}
        </div>
        <p className="mt-1 text-xs text-wows-muted">
          {locked ? "Closed" : "Closes"} <When iso={q.closesAt} />
          {q.revisedCount !== undefined ? (
            <> · revised {q.revisedCount}×</>
          ) : null}
        </p>

        {open ? (
          <div className="mt-4 border-t border-wows-rule pt-4">
            <p className="text-xs text-wows-muted">Resolves by</p>
            <p className="text-sm text-wows-ink">{q.resolutionCriteria}</p>

            {locked ? (
              <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-wows-muted">Your forecast</dt>
                <dd className="numeric text-wows-ink">{q.probability}%</dd>
                <dt className="text-wows-muted">Rationale</dt>
                <dd className="text-wows-ink">{q.rationale}</dd>
                <dt className="text-wows-muted">Status</dt>
                <dd className="text-wows-ink">
                  Locked at the deadline. Awaiting resolution.
                </dd>
              </dl>
            ) : (
              <form
                className="mt-4 flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
              >
                <div>
                  <div className="flex items-baseline justify-between">
                    <label
                      htmlFor={`p-${q.id}`}
                      className="text-sm font-medium text-wows-ink"
                    >
                      Probability it resolves yes
                    </label>
                    <output
                      htmlFor={`p-${q.id}`}
                      className="numeric text-lg font-semibold text-wows-ink"
                    >
                      {probability}%
                    </output>
                  </div>
                  <input
                    id={`p-${q.id}`}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={probability}
                    onChange={(e) => {
                      setProbability(Number(e.target.value));
                      setSubmitted(false);
                    }}
                    className="mt-2 w-full accent-wows-accent"
                  />
                  <div
                    className="numeric flex justify-between text-xs text-wows-muted"
                    aria-hidden="true"
                  >
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor={`r-${q.id}`}
                    className="text-sm font-medium text-wows-ink"
                  >
                    One-line rationale
                  </label>
                  <input
                    id={`r-${q.id}`}
                    type="text"
                    required
                    maxLength={200}
                    value={rationale}
                    onChange={(e) => {
                      setRationale(e.target.value);
                      setSubmitted(false);
                    }}
                    placeholder="What is the base rate, and what moves you off it?"
                    className="mt-1 w-full rounded-md border border-wows-rule bg-wows-surface px-3 py-2 text-sm text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" className={buttonClass.primary}>
                    {submitted ? "Update forecast" : "Submit forecast"}
                  </button>
                  {submitted ? (
                    <p role="status" className="text-sm text-wows-positive">
                      Saved. You can revise until the deadline.
                    </p>
                  ) : null}
                </div>
              </form>
            )}
          </div>
        ) : null}
      </Panel>
    </li>
  );
}
