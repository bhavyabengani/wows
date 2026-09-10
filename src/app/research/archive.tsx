"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Chip, When, buttonClass } from "@/components/preview/ui";
import {
  memberById,
  researchNotes,
  sparse as sparseData,
} from "@/preview-data";

const STATE_LABEL = {
  published: "Published",
  in_review: "In review",
  changes_requested: "Changes requested",
} as const;

export function ResearchArchive({ sparse = false }: { sparse?: boolean }) {
  const notes = sparse
    ? researchNotes.filter((n) => sparseData.noteSlugs.includes(n.slug))
    : researchNotes;
  const [query, setQuery] = useState("");
  const [vertical, setVertical] = useState("all");
  const [company, setCompany] = useState("all");
  const companies = useMemo(
    () => [...new Set(notes.map((n) => n.company))].sort(),
    [notes],
  );
  const results = notes.filter((n) => {
    const q = query.trim().toLowerCase();
    return (
      (vertical === "all" || n.vertical === vertical) &&
      (company === "all" || n.company === company) &&
      (!q ||
        [n.title, n.summary, n.company, n.ticker].some((s) =>
          s.toLowerCase().includes(q),
        ))
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="text-sm">
          <span className="sr-only">Search notes</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, company or ticker"
            className="w-full rounded-md border border-wows-rule bg-wows-surface px-3 py-2 text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
          />
        </label>
        <label className="text-sm">
          <span className="sr-only">Vertical</span>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="w-full rounded-md border border-wows-rule bg-wows-surface px-3 py-2 text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
          >
            <option value="all">All verticals</option>
            <option>Equities</option>
            <option>Macro & Fixed Income</option>
            <option>Quant</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Company</span>
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full rounded-md border border-wows-rule bg-wows-surface px-3 py-2 text-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
          >
            <option value="all">All companies</option>
            {companies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </form>

      <p className="numeric text-xs text-wows-muted" role="status">
        {results.length} of {notes.length} notes
      </p>

      <ul className="divide-y divide-wows-rule border-t border-wows-rule">
        {results.map((n) => {
          const author = memberById(n.authorId);
          return (
            <li
              key={n.slug}
              className="grid gap-2 py-4 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/research/${n.slug}`}
                    className="font-medium text-wows-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
                  >
                    {n.title}
                  </Link>
                  {n.state !== "published" ? (
                    <Chip>{STATE_LABEL[n.state]}</Chip>
                  ) : null}
                  {n.stale ? (
                    <Chip tone="warn">
                      Stale: written before the August MPC
                    </Chip>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-wows-muted">{n.summary}</p>
                <p className="mt-1 text-xs text-wows-muted">
                  {n.company} ({n.ticker}), {n.vertical}. {author.name},{" "}
                  {author.cohort}.
                </p>
              </div>
              <When
                iso={n.publishedAt}
                withTime={false}
                className="text-xs text-wows-muted sm:text-right"
              />
            </li>
          );
        })}
        {results.length === 0 ? (
          <li className="py-8 text-center text-sm text-wows-muted">
            Nothing matches.{" "}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setVertical("all");
                setCompany("all");
              }}
              className={buttonClass.quiet}
            >
              Clear filters
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
