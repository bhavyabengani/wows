import {
  Callout,
  Chip,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  When,
  buttonClass,
  td,
  tdNum,
  th,
  thNum,
} from "@/components/preview/ui";
import { adminSeasons, settlementWarning } from "@/preview-data";
import { AdminNav } from "../nav";

export const metadata = { title: "Admin — seasons" };

const FLOW = ["draft", "open", "closed", "settled", "archived"] as const;

export default function AdminSeasonsPage() {
  const open = adminSeasons.find((s) => s.state === "open");

  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Seasons"
        lede="A season is one semester, and everything belongs to exactly one. The state machine runs in one direction only."
      />
      <AdminNav />

      <Section title="The state machine">
        <ol className="flex flex-wrap items-center gap-2">
          {FLOW.map((state, i) => (
            <li key={state} className="flex items-center gap-2">
              <span
                className={
                  state === "settled"
                    ? "border border-wows-accent bg-wows-accent px-2 py-1 text-xs font-medium text-wows-paper"
                    : "border border-wows-rule bg-wows-surface px-2 py-1 text-xs font-medium text-wows-muted"
                }
              >
                {state}
              </span>
              {i < FLOW.length - 1 ? (
                <span aria-hidden="true" className="text-wows-muted">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          Settling is the one-way door. Once a season is settled, nothing inside
          it can be changed again — not a score, not a thesis, not a resolved
          forecast. A correction after settlement is a new compensating record,
          never an edit.
        </p>
      </Section>

      <Section title="All seasons">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Season</th>
              <th className={th}>State</th>
              <th className={th}>Runs</th>
              <th className={thNum}>Members</th>
              <th className={thNum}>Questions</th>
              <th className={thNum}>Notes</th>
              <th className={thNum}>Min forecasts</th>
              <th className={thNum}>Action</th>
            </tr>
          </thead>
          <tbody>
            {adminSeasons.map((s) => (
              <tr key={s.name}>
                <td className={td}>
                  <span className="font-medium text-wows-ink">{s.name}</span>
                </td>
                <td className={td}>
                  <Chip
                    tone={
                      s.state === "open"
                        ? "accent"
                        : s.state === "settled"
                          ? "positive"
                          : "neutral"
                    }
                  >
                    {s.state}
                  </Chip>
                </td>
                <td className={td}>
                  <span className="text-xs text-wows-muted">
                    <When iso={s.startsAt} withTime={false} /> –{" "}
                    <When iso={s.endsAt} withTime={false} />
                  </span>
                </td>
                <td className={tdNum}>{s.members}</td>
                <td className={tdNum}>{s.forecastQuestions}</td>
                <td className={tdNum}>{s.notes}</td>
                <td className={tdNum}>{s.minResolvedForecasts}</td>
                <td className={tdNum}>
                  <button
                    type="button"
                    className={buttonClass.quiet}
                    disabled={s.state === "settled" || s.state === "archived"}
                  >
                    {s.state === "draft"
                      ? "Open"
                      : s.state === "open"
                        ? "Close"
                        : s.state === "closed"
                          ? "Settle"
                          : "—"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Section>

      {open ? (
        <Section title={`Settling ${open.name}`}>
          <Panel tone="accent">
            <h3 className="text-[15px] font-semibold text-wows-ink">
              What settling does, before you do it
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {settlementWarning.map((line) => (
                <li
                  key={line}
                  className="max-w-prose border-b border-wows-rule pb-2 text-[15px] leading-relaxed text-wows-muted last:border-b-0"
                >
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button type="button" className={buttonClass.primary} disabled>
                Settle {open.name}
              </button>
              <p className="text-[12.5px] text-wows-accent">
                Blocked: 2 forecast questions are neither resolved nor voided.
              </p>
            </div>
          </Panel>
        </Section>
      ) : null}

      <Callout>
        <p className="text-[12.5px] leading-relaxed text-wows-muted">
          The minimum-forecast threshold is a property of the season, not a
          constant in the code, so a first semester with few questions can set a
          lower bar without rewriting the scoring. Members below it see their
          score and are told it does not yet qualify.
        </p>
      </Callout>
    </main>
  );
}
