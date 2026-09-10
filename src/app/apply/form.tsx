"use client";

import { useState } from "react";
import { cn } from "cn";
import {
  Callout,
  Chip,
  Panel,
  Section,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { application, type ApplicationField } from "@/preview-data";

/** Words typed so far, for the fields that state a minimum. */
function words(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ApplicationField;
  value: string;
  onChange: (v: string) => void;
}) {
  const count = words(value);
  const met = field.minWords === undefined || count >= field.minWords;
  const id = `apply-${field.name}`;
  return (
    <div className="border-b border-wows-rule py-4 last:border-b-0">
      <label
        htmlFor={id}
        className="block text-[15px] font-semibold text-wows-ink"
      >
        {field.label}
        {field.required ? null : (
          <span className="ml-2 text-xs font-normal text-wows-muted">
            optional
          </span>
        )}
      </label>
      <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-wows-muted">
        {field.help}
      </p>
      {field.kind === "select" ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full max-w-sm border border-wows-rule bg-wows-surface px-3 py-2 text-sm text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
        >
          <option value="">Select…</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.kind === "long" ? (
        <>
          <textarea
            id={id}
            rows={5}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby={`${id}-count`}
            className="mt-2 w-full border border-wows-rule bg-wows-surface px-3 py-2 text-sm leading-relaxed text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
          />
          <p
            id={`${id}-count`}
            className={cn(
              "numeric mt-1 text-xs",
              met ? "text-wows-positive" : "text-wows-muted",
            )}
          >
            {met ? "✓ " : ""}
            {count} of {field.minWords} words minimum
          </p>
        </>
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full max-w-md border border-wows-rule bg-wows-surface px-3 py-2 text-sm text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
        />
      )}
    </div>
  );
}

export function ApplicationForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return <AfterSubmitting onBack={() => setSubmitted(false)} />;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem] lg:items-start">
      <Panel>
        <div className="flex flex-col">
          {application.fields.map((f) => (
            <Field
              key={f.name}
              field={f}
              value={values[f.name] ?? ""}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
            />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-wows-rule pt-4">
          <button
            type="button"
            className={buttonClass.primary}
            onClick={() => setSubmitted(true)}
          >
            Submit application
          </button>
          <p className="text-[12.5px] text-wows-muted">
            Nothing is sent in the preview. You can revise an application until
            the window closes.
          </p>
        </div>
      </Panel>

      <aside className="flex flex-col gap-6">
        <Section title="This round" className="border-t-wows-ink">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-wows-muted">Closes</dt>
              <dd className="text-wows-ink">
                <When iso={application.windowCloses} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-wows-muted">Places</dt>
              <dd className="numeric text-wows-ink">
                {application.cohortSize}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-wows-muted">Applications so far</dt>
              <dd className="numeric text-wows-ink">
                {application.applicants}
              </dd>
            </div>
          </dl>
        </Section>
        <Callout>
          <p className="text-[12.5px] leading-relaxed text-wows-muted">
            We do not ask for a CV, a cover letter or a stock pitch. Prior
            finance knowledge is not a requirement and is not scored.
          </p>
        </Callout>
      </aside>
    </div>
  );
}

/** What an applicant sees once they have applied: the review states, in order. */
function AfterSubmitting({ onBack }: { onBack: () => void }) {
  const currentIndex = 0;
  return (
    <div className="flex flex-col gap-8">
      <Panel tone="accent">
        <h2 className="text-xl font-semibold tracking-tight text-wows-ink">
          Your application is in
        </h2>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          A copy has gone to your Ashoka address. You can revise any answer
          until the window closes on{" "}
          <When iso={application.windowCloses} withTime={false} />; after that
          it locks and core begins reading.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonClass.secondary}
            onClick={onBack}
          >
            Revise my answers
          </button>
        </div>
      </Panel>

      <Section title="What happens next">
        <ol className="flex flex-col border-t border-wows-rule">
          {application.states.map((s, i) => (
            <li
              key={s.key}
              className="grid gap-1 border-b border-wows-rule py-4 sm:grid-cols-[12rem_1fr] sm:gap-8"
            >
              <div className="flex items-baseline gap-3">
                <Chip tone={i === currentIndex ? "accent" : "neutral"}>
                  {i === currentIndex ? "Now" : `Step ${i + 1}`}
                </Chip>
                <span className="text-[15px] font-semibold text-wows-ink">
                  {s.label}
                </span>
              </div>
              <div>
                <p className="max-w-prose text-[15px] leading-relaxed text-wows-muted">
                  {s.body}
                </p>
                <p className="mt-1 text-xs text-wows-muted">
                  <When iso={s.when} withTime={false} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
