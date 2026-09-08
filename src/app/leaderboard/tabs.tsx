"use client";

import { Tabs } from "radix-ui";
import { useState } from "react";
import { cn } from "cn";
import {
  Sparkline,
  When,
  buttonClass,
  td,
  tdNum,
  th,
  thNum,
  TableWrap,
} from "@/components/preview/ui";
import {
  previewUser,
  trackInfo,
  leaderboards,
  memberById,
  sampleSeries,
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
          className="flex min-w-max border-b border-wows-ink"
        >
          {trackInfo.map((t) => (
            <Tabs.Trigger
              key={t.key}
              value={t.key}
              className={cn(
                "px-3.5 py-2.5 text-[15px] whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wows-accent-soft",
                "data-[state=active]:bg-wows-accent data-[state=active]:font-semibold data-[state=active]:text-wows-paper",
                "data-[state=inactive]:text-wows-muted data-[state=inactive]:hover:text-wows-ink",
                t.key === "calibration" && "font-semibold",
              )}
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>

      <Tabs.Content
        value={track}
        className="mt-6 flex flex-col gap-6 focus:outline-none"
      >
        <div className="grid gap-5 md:grid-cols-[3fr_2fr]">
          <p className="max-w-prose text-[15px] leading-relaxed text-wows-ink">
            {info.method}
          </p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 self-start text-[12.5px] text-wows-muted md:border-l md:border-wows-rule md:pl-5">
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
          <div className="border-l-[3px] border-wows-accent pl-4">
            <p className="text-[15px] font-medium text-wows-ink">
              Weights, Monsoon 2026
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-[15px]">
              {info.weights.map((w) => (
                <li key={w.track} className="flex items-baseline gap-2">
                  <span className="text-wows-muted">{w.label}</span>
                  <span className="numeric text-wows-ink">{w.weight}%</span>
                </li>
              ))}
            </ul>
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
              <th scope="col" className={cn(th, "hidden md:table-cell")}>
                Vertical
              </th>
              <th scope="col" className={cn(th, "hidden sm:table-cell")}>
                <span className="sr-only">Trend</span>
              </th>
              <th scope="col" className={thNum}>
                {info.valueLabel}
              </th>
              <th
                scope="col"
                className={cn(thNum, "hidden w-16 sm:table-cell")}
              >
                Δ wk
              </th>
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
  const series = sampleSeries(row.rank * 7 + row.memberId.length, 50, 12);
  const delta =
    row.delta === 0 ? (
      <span className="text-wows-muted">— 0</span>
    ) : row.delta > 0 ? (
      <span className="text-wows-positive">▲ +{row.delta}</span>
    ) : (
      <span className="text-wows-accent">▼ {row.delta}</span>
    );
  return (
    <>
      <tr className={cn(you && "bg-wows-accent/6")}>
        <td
          className={cn(tdNum, "pl-0 pr-3 text-left text-[17px] font-medium")}
        >
          {row.rank}
        </td>
        <td className={td}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={contentId}
            className="text-left text-[15px] text-wows-ink underline decoration-wows-rule underline-offset-4 hover:decoration-wows-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
          >
            {m.name}
            {you ? (
              <span className="ml-2 text-[12.5px] text-wows-accent">you</span>
            ) : null}
          </button>
          <span className="mt-0.5 flex items-center gap-3 text-[12.5px] text-wows-muted md:hidden">
            <span>{m.vertical}</span>
            <span className="numeric sm:hidden">{delta}</span>
          </span>
        </td>
        <td className={cn(td, "hidden text-wows-muted md:table-cell")}>
          {m.vertical}
        </td>
        <td className={cn(td, "hidden sm:table-cell")}>
          <Sparkline values={series} tone="muted" />
        </td>
        <td className={cn(tdNum, "text-[15px] font-medium")}>{row.value}</td>
        <td className={cn(tdNum, "hidden sm:table-cell")}>{delta}</td>
      </tr>
      {open ? (
        <tr id={contentId}>
          <td colSpan={6} className="border-b border-wows-rule p-0">
            <div className="animate-drawer border-l-[3px] border-wows-accent bg-wows-paper px-4 py-4 sm:ml-10 sm:px-5">
              <p className="text-[12.5px] text-wows-muted">
                How this rank is built
              </p>
              <dl className="mt-1.5 grid gap-x-10 gap-y-1.5 text-[15px] sm:grid-cols-2">
                {row.components.map((c) => (
                  <div
                    key={c.label}
                    className="flex items-baseline justify-between gap-4 border-b border-wows-rule/60 pb-1"
                  >
                    <dt className="text-wows-muted">{c.label}</dt>
                    <dd className="numeric text-right text-wows-ink">
                      {c.value}
                      {c.note ? (
                        <span className="ml-1 font-sans text-[12.5px] text-wows-muted">
                          ({c.note})
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`${buttonClass.quiet} mt-3 -ml-1`}
              >
                Close
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
