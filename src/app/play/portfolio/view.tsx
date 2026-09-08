"use client";

import { useState } from "react";
import { cn } from "cn";
import {
  Chip,
  Money,
  Panel,
  Section,
  SignedFigure,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { positions } from "@/preview-data";

const MIN_WORDS = 150;
const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function PortfolioView() {
  return (
    <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
      <Section title="Open positions">
        <ul className="flex flex-col gap-4">
          {positions.map((p) => {
            const pnl = (p.lastPaise - p.entryPaise) * BigInt(p.quantity);
            const bps = Number(
              ((p.lastPaise - p.entryPaise) * 10000n) / p.entryPaise,
            );
            return (
              <li key={p.id}>
                <Panel>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-wows-ink">
                        {p.ticker}{" "}
                        <span className="font-normal text-wows-muted">
                          {p.name}
                        </span>
                      </p>
                      <p className="text-xs text-wows-muted">
                        Opened <When iso={p.openedAt} />, {p.quantity} units at{" "}
                        <Money paise={p.entryPaise} />
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="numeric text-sm text-wows-ink">
                        Last <Money paise={p.lastPaise} />
                      </p>
                      <p className="text-sm">
                        <SignedFigure paise={pnl} />{" "}
                        <SignedFigure bps={bps} className="text-xs" />
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-3 border-t border-wows-rule pt-4 text-sm">
                    <div>
                      <dt className="text-xs text-wows-muted">Thesis</dt>
                      <dd className="mt-0.5 leading-relaxed text-wows-ink">
                        {p.thesis}
                      </dd>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-wows-muted">Key risk</dt>
                        <dd className="mt-0.5 text-wows-ink">{p.keyRisk}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-wows-muted">Falsifier</dt>
                        <dd className="mt-0.5 text-wows-ink">{p.falsifier}</dd>
                      </div>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Chip>Revision 1</Chip>
                    <button type="button" className={buttonClass.quiet}>
                      Add a revision
                    </button>
                    <button type="button" className={buttonClass.quiet}>
                      Close position
                    </button>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      </Section>

      <OpenPositionForm />
    </div>
  );
}

function OpenPositionForm() {
  const [thesis, setThesis] = useState("");
  const [done, setDone] = useState(false);
  const words = countWords(thesis);
  const ok = words >= MIN_WORDS;
  return (
    <Section title="Open a position">
      {done ? (
        <Panel tone="accent">
          <p role="status" className="font-medium text-wows-ink">
            Position opened at Monday&apos;s close
          </p>
          <p className="mt-1 text-sm text-wows-muted">
            Your thesis is revision 1 and cannot be edited. Changes are new
            revisions, kept side by side.
          </p>
          <button
            type="button"
            onClick={() => setDone(false)}
            className={`${buttonClass.secondary} mt-3`}
          >
            Open another
          </button>
        </Panel>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) setDone(true);
          }}
        >
          <p className="text-sm text-wows-muted">
            A position needs a written thesis of at least {MIN_WORDS} words with
            a reason, a key risk and an explicit falsifier. Fills happen at the
            next close; there is no intraday.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-wows-ink">Instrument</span>
              <select
                className="mt-1 w-full rounded-md border border-wows-rule bg-wows-surface px-3 py-2 text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
                defaultValue="INFY"
              >
                <option value="RELIANCE">RELIANCE</option>
                <option value="TCS">TCS</option>
                <option value="HDFCBANK">HDFCBANK</option>
                <option value="INFY">INFY</option>
                <option value="NIFTYBEES">NIFTYBEES</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-wows-ink">Units</span>
              <input
                type="number"
                min={1}
                defaultValue={20}
                className="numeric mt-1 w-full rounded-md border border-wows-rule bg-wows-surface px-3 py-2 text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
              />
            </label>
          </div>
          <label className="text-sm">
            <span className="flex items-baseline justify-between">
              <span className="font-medium text-wows-ink">Thesis</span>
              <span
                className={cn(
                  "numeric text-xs",
                  ok ? "text-wows-positive" : "text-wows-muted",
                )}
              >
                {words} / {MIN_WORDS} words
              </span>
            </span>
            <textarea
              rows={8}
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              placeholder="What do you expect, why, and by when?"
              className="mt-1 w-full rounded-md border border-wows-rule bg-wows-surface px-3 py-2 text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-wows-ink">Key risk</span>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-md border border-wows-rule bg-wows-surface px-3 py-2 text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-wows-ink">Falsifier</span>
            <span className="block text-xs text-wows-muted">
              An observable fact with a date that would prove you wrong.
            </span>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-md border border-wows-rule bg-wows-surface px-3 py-2 text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!ok}
              className={buttonClass.primary}
            >
              Open position
            </button>
            {!ok ? (
              <p className="text-xs text-wows-muted">
                {MIN_WORDS - words} more words to go.
              </p>
            ) : null}
          </div>
        </form>
      )}
    </Section>
  );
}
