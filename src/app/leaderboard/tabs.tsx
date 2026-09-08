"use client";

import { Tabs } from "radix-ui";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { When, td, tdNum, th, thNum, TableWrap } from "@/components/preview/ui";
import {
  previewUser,
  trackInfo,
  leaderboards,
  memberById,
  type TrackKey,
} from "@/preview-data";

export function LeaderboardTabs() {
  const [track, setTrack] = useState<TrackKey>("calibration");
  const info = trackInfo.find((t) => t.key === track)!;
  const rows = leaderboards[track];

  return (
    <Tabs.Root value={track} onValueChange={(v) => setTrack(v as TrackKey)}>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Tabs.List
          aria-label="Leaderboard tracks"
          className="flex min-w-max gap-1 border-b border-wows-rule"
        >
          {trackInfo.map((t) => (
            <Tabs.Trigger
              key={t.key}
              value={t.key}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wows-accent-soft",
                "data-[state=active]:border-wows-accent data-[state=active]:font-medium data-[state=active]:text-wows-ink",
                "data-[state=inactive]:border-transparent data-[state=inactive]:text-wows-muted data-[state=inactive]:hover:text-wows-ink",
                t.key === "calibration" && "text-base",
              )}
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>

      <Tabs.Content
        value={track}
        className="mt-5 flex flex-col gap-5 focus:outline-none"
      >
        <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
          <p className="text-sm leading-relaxed text-wows-ink">{info.method}</p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs text-wows-muted">
            <dt>Last updated</dt>
            <dd>
              <When iso={info.updatedAt} className="text-wows-ink" />
            </dd>
            <dt>Minimum</dt>
            <dd className="text-wows-ink">{info.minimum}</dd>
            <dt>Ranked</dt>
            <dd className="numeric text-wows-ink">{rows.length} members</dd>
          </dl>
        </div>

        {info.weights ? (
          <div className="rounded-md border border-wows-rule bg-wows-surface p-4">
            <h3 className="text-sm font-medium text-wows-ink">
              Weights for {"Monsoon 2026"}
            </h3>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {info.weights.map((w) => (
                <li key={w.track} className="flex items-baseline gap-2">
                  <span className="text-wows-muted">{w.label}</span>
                  <span className="numeric text-wows-ink">{w.weight}%</span>
                </li>
              ))}
            </ul>
            <div
              className="mt-3 flex h-2 w-full overflow-hidden rounded-full"
              aria-hidden="true"
            >
              {info.weights.map((w, i) => (
                <div
                  key={w.track}
                  style={{ width: `${w.weight}%` }}
                  className={cn(
                    i % 2 === 0 ? "bg-wows-accent" : "bg-wows-accent-soft",
                    i > 0 && "border-l border-wows-surface",
                  )}
                />
              ))}
            </div>
          </div>
        ) : null}

        <TableWrap>
          <thead>
            <tr>
              <th scope="col" className={cn(thNum, "w-10 pl-0 pr-3 text-left")}>
                #
              </th>
              <th scope="col" className={th}>
                Member
              </th>
              <th scope="col" className={cn(th, "hidden sm:table-cell")}>
                Vertical
              </th>
              <th scope="col" className={thNum}>
                {info.valueLabel}
              </th>
              <th scope="col" className={cn(thNum, "w-20")}>
                Δ
              </th>
              <th
                scope="col"
                className="w-8 border-b border-wows-rule"
                aria-label="Expand"
              />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row key={row.memberId} row={row} />
            ))}
          </tbody>
        </TableWrap>
      </Tabs.Content>
    </Tabs.Root>
  );
}

function Row({ row }: { row: (typeof leaderboards)[TrackKey][number] }) {
  const [open, setOpen] = useState(false);
  const m = memberById(row.memberId);
  const you = m.name === previewUser.name;
  const contentId = `components-${row.memberId}-${row.rank}`;
  const toggle = () => setOpen((o) => !o);
  return (
    <>
      <tr className={cn(you && "bg-wows-surface")}>
        <td className={cn(tdNum, "pl-0 pr-3 text-left font-semibold")}>
          {row.rank}
        </td>
        <td className={td}>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={contentId}
            className="text-left text-wows-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
          >
            {m.name}
            {you ? (
              <span className="ml-2 text-xs text-wows-muted">(you)</span>
            ) : null}
          </button>
          <span className="block text-xs text-wows-muted sm:hidden">
            {m.vertical}
          </span>
        </td>
        <td className={cn(td, "hidden text-wows-muted sm:table-cell")}>
          {m.vertical}
        </td>
        <td className={cn(tdNum, "font-medium")}>{row.value}</td>
        <td className={tdNum}>
          {row.delta === 0 ? (
            <span className="text-wows-muted">—</span>
          ) : row.delta > 0 ? (
            <span className="text-wows-positive">▲ +{row.delta}</span>
          ) : (
            <span className="text-wows-accent">▼ {row.delta}</span>
          )}
        </td>
        <td className={cn(td, "pr-0")}>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={contentId}
            aria-label={open ? "Hide components" : "Show components"}
            className="grid size-7 place-items-center rounded-sm text-wows-muted hover:bg-wows-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
          >
            <ChevronRight
              className={cn("size-4 transition-transform", open && "rotate-90")}
              aria-hidden="true"
            />
          </button>
        </td>
      </tr>
      {open ? (
        <tr id={contentId}>
          <td
            colSpan={6}
            className="border-b border-wows-rule bg-wows-paper px-3 py-3 sm:px-6"
          >
            <p className="text-xs text-wows-muted">How this rank is built</p>
            <dl className="mt-1 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              {row.components.map((c) => (
                <div
                  key={c.label}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="text-wows-muted">{c.label}</dt>
                  <dd className="numeric text-right text-wows-ink">
                    {c.value}
                    {c.note ? (
                      <span className="ml-1 text-xs text-wows-muted">
                        ({c.note})
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}
