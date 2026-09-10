import Link from "next/link";
import {
  Chip,
  Meta,
  PageHeader,
  Panel,
  Section,
  Sparkline,
  TableWrap,
  When,
  td,
  tdNum,
  th,
  thNum,
} from "@/components/preview/ui";
import { myNotes, previewUser, profile, season, sparse } from "@/preview-data";

export const metadata = { title: "My profile" };

const MIN_RESOLVED = 8;

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const isSparse = (await searchParams).state === "sparse";
  const history = isSparse
    ? profile.forecastHistory.slice(0, sparse.resolvedForecasts)
    : profile.forecastHistory;
  const meanBrier =
    history.reduce((sum, f) => sum + f.brier, 0) / (history.length || 1);
  const qualifies = history.length >= MIN_RESOLVED;
  const published = myNotes.filter((n) => n.state === "published");

  return (
    <main className="flex flex-col gap-10">
      <PageHeader
        title={previewUser.name}
        lede={`${previewUser.role[0]!.toUpperCase()}${previewUser.role.slice(1)}, ${previewUser.vertical}, ${previewUser.cohort}. Everything here is yours alone until a season settles.`}
        aside={
          <Link
            href={isSparse ? "/me" : "/me?state=sparse"}
            className="text-sm text-wows-accent underline underline-offset-4"
          >
            {isSparse ? "Full history" : "Sparse view"}
          </Link>
        }
      />

      {isSparse ? (
        <Panel tone="accent">
          <p className="text-[12.5px] leading-relaxed text-wows-muted">
            {sparse.note}
          </p>
        </Panel>
      ) : null}

      <Section title="Standing this season">
        <p className="mb-3 max-w-prose text-[15px] text-wows-muted">
          Your position on each track in {season.name}. A track you have not met
          the minimum participation for shows no rank rather than a flattering
          one.
        </p>
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Track</th>
              <th className={thNum}>Rank</th>
              <th className={thNum}>Value</th>
              <th className={th}>Qualifies</th>
            </tr>
          </thead>
          <tbody>
            {profile.standing.map((s) => (
              <tr key={s.track}>
                <td className={td}>
                  <Link
                    href="/leaderboard"
                    className="font-medium text-wows-ink underline decoration-wows-rule underline-offset-4"
                  >
                    {s.label}
                  </Link>
                </td>
                <td className={tdNum}>
                  {s.qualifies ? (
                    <>
                      {s.rank}
                      <span className="text-wows-muted"> / {s.of}</span>
                    </>
                  ) : (
                    <span className="text-wows-muted">—</span>
                  )}
                </td>
                <td className={tdNum}>{s.value}</td>
                <td className={td}>
                  {s.qualifies ? (
                    <span className="text-wows-muted">Yes</span>
                  ) : (
                    <Chip tone="warn">Below the minimum</Chip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Section>

      <Section title="Forecasts">
        <div className="grid gap-6 sm:grid-cols-[14rem_1fr] sm:items-start">
          <Panel>
            <p className="text-[12.5px] text-wows-muted">Mean Brier score</p>
            <p className="numeric mt-1 text-[32px] leading-none font-medium text-wows-ink">
              {meanBrier.toFixed(3)}
            </p>
            <p className="numeric mt-2 text-xs text-wows-muted">
              over {history.length} resolved
            </p>
            {qualifies ? null : (
              <p className="mt-3 border-t border-wows-rule pt-3 text-[12.5px] leading-relaxed text-wows-muted">
                Not yet qualifying for the Calibration track. It needs{" "}
                <span className="numeric">{MIN_RESOLVED}</span> resolved
                forecasts; you have{" "}
                <span className="numeric">{history.length}</span>. The score is
                shown so you can watch it move, not so it can be ranked.
              </p>
            )}
          </Panel>
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>Question</th>
                <th className={thNum}>You said</th>
                <th className={th}>Outcome</th>
                <th className={thNum}>Brier</th>
              </tr>
            </thead>
            <tbody>
              {history.map((f) => (
                <tr key={f.question}>
                  <td className={td}>
                    <span className="text-wows-ink">{f.question}</span>
                    <span className="mt-0.5 block text-xs text-wows-muted">
                      resolved <When iso={f.resolvedAt} withTime={false} />
                    </span>
                  </td>
                  <td className={tdNum}>{f.said}%</td>
                  <td className={td}>
                    <Chip tone={f.outcome ? "positive" : "neutral"}>
                      {f.outcome ? "Happened" : "Did not happen"}
                    </Chip>
                  </td>
                  <td className={tdNum}>{f.brier.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      </Section>

      <Section title="Curriculum">
        <ul className="flex flex-col border-t border-wows-rule">
          {profile.curriculum.map((c) => (
            <li
              key={c.track}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-wows-rule py-3"
            >
              <span className="text-[15px] text-wows-ink">{c.track}</span>
              <span className="flex items-center gap-4">
                <Sparkline
                  values={Array.from({ length: c.of }, (_, i) =>
                    i < c.done ? 1 : 0,
                  )}
                  tone={c.done === c.of ? "positive" : "muted"}
                />
                <span className="numeric text-sm text-wows-muted">
                  {c.done} / {c.of} modules
                </span>
                {c.completedAt ? (
                  <Chip tone="positive">Complete</Chip>
                ) : c.done === 0 ? (
                  <Chip>Not started</Chip>
                ) : (
                  <Chip tone="warn">In progress</Chip>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Published research"
        action={
          <Link
            href="/research/mine"
            className="text-sm text-wows-accent underline underline-offset-4"
          >
            All my notes
          </Link>
        }
      >
        {published.length === 0 ? (
          <p className="text-[15px] text-wows-muted">
            Nothing published yet. A note becomes visible to the club after a
            reviewer and, for curriculum, the faculty adviser have signed it
            off.
          </p>
        ) : (
          <ul className="flex flex-col border-t border-wows-rule">
            {published.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-wows-rule py-3"
              >
                <Link
                  href="/research/tcs-margin-trajectory-fy27"
                  className="text-[15px] text-wows-ink underline decoration-wows-rule underline-offset-4"
                >
                  {n.title}
                </Link>
                <span className="numeric text-xs text-wows-muted">
                  {n.words} words · <When iso={n.updatedAt} withTime={false} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Events attended">
        <ul className="flex flex-col border-t border-wows-rule">
          {profile.attendance.map((e) => (
            <li
              key={e.title}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-wows-rule py-3"
            >
              <span className="text-[15px] text-wows-ink">{e.title}</span>
              <span className="flex items-center gap-3">
                <When
                  iso={e.at}
                  withTime={false}
                  className="text-xs text-wows-muted"
                />
                {e.attended ? (
                  <Chip tone="positive">Attended</Chip>
                ) : (
                  <Chip>RSVP&rsquo;d</Chip>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Account">
        <Meta
          items={[
            { label: "Email", value: previewUser.email },
            { label: "Vertical", value: previewUser.vertical },
            {
              label: "Member since",
              value: (
                <When iso={`${profile.joined}T00:00:00Z`} withTime={false} />
              ),
            },
          ]}
        />
      </Section>
    </main>
  );
}
