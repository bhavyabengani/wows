"use client";

import { useState } from "react";
import { cn } from "cn";
import { Callout, Panel, Section, buttonClass } from "@/components/preview/ui";
import { researchGuidelines, researchRubric } from "@/preview-data";

function words(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function Long({
  id,
  label,
  help,
  min,
  rows,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  min?: number;
  rows: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const count = words(value);
  const met = min === undefined || count >= min;
  return (
    <div className="border-b border-wows-rule py-4 last:border-b-0">
      <label
        htmlFor={id}
        className="block text-[15px] font-semibold text-wows-ink"
      >
        {label}
      </label>
      <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-wows-muted">
        {help}
      </p>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border border-wows-rule bg-wows-surface px-3 py-2 text-sm leading-relaxed text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
      />
      {min === undefined ? null : (
        <p
          className={cn(
            "numeric mt-1 text-xs",
            met ? "text-wows-positive" : "text-wows-muted",
          )}
        >
          {met ? "✓ " : ""}
          {count} of {min} words minimum
        </p>
      )}
    </div>
  );
}

export function SubmitForm() {
  const [v, setV] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const set = (k: string) => (val: string) => setV((p) => ({ ...p, [k]: val }));
  const falsifierGiven = words(v.falsifier ?? "") >= 12;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="flex flex-col gap-6">
        {sent ? (
          <Panel tone="accent">
            <h2 className="text-xl font-semibold tracking-tight text-wows-ink">
              Sent for review
            </h2>
            <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
              Your note is in the queue. A vertical lead reads it against the
              rubric and either publishes it, asks for changes with comments
              against specific criteria, or returns it. You will be able to
              revise and resubmit; the original stays as a revision.
            </p>
            <button
              type="button"
              className={cn(buttonClass.secondary, "mt-4")}
              onClick={() => setSent(false)}
            >
              Back to the draft
            </button>
          </Panel>
        ) : null}

        <Panel>
          <div className="grid gap-4 border-b border-wows-rule pb-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="rs-company"
                className="block text-[15px] font-semibold text-wows-ink"
              >
                Company or subject
              </label>
              <input
                id="rs-company"
                value={v.company ?? ""}
                onChange={(e) => set("company")(e.target.value)}
                className="mt-2 w-full border border-wows-rule bg-wows-surface px-3 py-2 text-sm text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
              />
            </div>
            <div>
              <label
                htmlFor="rs-vertical"
                className="block text-[15px] font-semibold text-wows-ink"
              >
                Vertical
              </label>
              <select
                id="rs-vertical"
                value={v.vertical ?? ""}
                onChange={(e) => set("vertical")(e.target.value)}
                className="mt-2 w-full border border-wows-rule bg-wows-surface px-3 py-2 text-sm text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
              >
                <option value="">Select…</option>
                <option>Equities</option>
                <option>Macro &amp; Fixed Income</option>
                <option>Quant</option>
              </select>
            </div>
          </div>

          <Long
            id="rs-thesis"
            label="Thesis"
            help="One paragraph. What you believe, and where it departs from what is already priced. Not a summary of the company."
            min={80}
            rows={5}
            value={v.thesis ?? ""}
            onChange={set("thesis")}
          />
          <Long
            id="rs-risks"
            label="Key risks"
            help="At least three, one per line. Each one must be capable of breaking the thesis. “Market volatility” is not a risk."
            min={40}
            rows={4}
            value={v.risks ?? ""}
            onChange={set("risks")}
          />
          <Long
            id="rs-falsifier"
            label="Falsifier"
            help="The observation that would make you abandon this, stated before the fact, with a number and a date. “It plays out over a longer horizon” is not a falsifier."
            min={12}
            rows={3}
            value={v.falsifier ?? ""}
            onChange={set("falsifier")}
          />
          <Long
            id="rs-sources"
            label="Sources"
            help="One per line, with a link. Every number in the note traces to one of these."
            rows={3}
            value={v.sources ?? ""}
            onChange={set("sources")}
          />
          <Long
            id="rs-body"
            label="The note"
            help="The full argument. Assume a first-year in another vertical is reading it."
            min={600}
            rows={10}
            value={v.body ?? ""}
            onChange={set("body")}
          />

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-wows-rule pt-4">
            <button
              type="button"
              disabled={!falsifierGiven}
              className={buttonClass.primary}
              onClick={() => setSent(true)}
            >
              Send for review
            </button>
            <button type="button" className={buttonClass.secondary}>
              Save draft
            </button>
            {falsifierGiven ? null : (
              <p className="text-[12.5px] text-wows-accent">
                The falsifier is required before a note can go to a reviewer.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <aside className="flex flex-col gap-6">
        <Section title="How this is reviewed" className="border-t-wows-ink">
          <ul className="flex flex-col border-t border-wows-rule">
            {researchRubric.map((r) => (
              <li key={r.criterion} className="border-b border-wows-rule py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[15px] font-semibold text-wows-ink">
                    {r.criterion}
                  </h3>
                  <span className="numeric text-xs text-wows-muted">
                    {r.weight}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-wows-muted">
                  {r.body}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Callout>
          <h3 className="text-[15px] font-semibold text-wows-ink">
            Before you send
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {researchGuidelines.map((g) => (
              <li
                key={g}
                className="text-[12.5px] leading-relaxed text-wows-muted"
              >
                {g}
              </li>
            ))}
          </ul>
        </Callout>
      </aside>
    </div>
  );
}
