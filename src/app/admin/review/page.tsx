import {
  Callout,
  Chip,
  PageHeader,
  Panel,
  Section,
  When,
  buttonClass,
  td,
  th,
  thNum,
  tdNum,
  TableWrap,
} from "@/components/preview/ui";
import { memberById, researchRubric, reviewQueue } from "@/preview-data";
import { AdminNav } from "../nav";

export const metadata = { title: "Admin — review" };

export default function AdminReviewPage() {
  const awaiting = reviewQueue.filter((r) => r.state === "awaiting_review");
  const faculty = reviewQueue.filter((r) => r.state === "awaiting_faculty");
  const returned = reviewQueue.filter((r) => r.state === "changes_requested");

  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Review queue"
        lede="Nothing a member writes becomes club-visible without passing through here. Reviewers comment against a named criterion, so an author gets a reason rather than a verdict."
      />
      <AdminNav />

      <Section title={`Awaiting a reviewer (${awaiting.length})`}>
        <Queue items={awaiting} showActions />
      </Section>

      <Section title={`Awaiting the faculty gate (${faculty.length})`}>
        <p className="mb-3 max-w-prose text-[15px] text-wows-muted">
          A vertical lead has approved these. Curriculum modules and any note
          the adviser has asked to see need a second signature that only the
          faculty adviser can give; a lead cannot pass this gate.
        </p>
        <Queue items={faculty} showActions={false} />
      </Section>

      <Section title={`Returned for changes (${returned.length})`}>
        <Queue items={returned} showActions={false} />
      </Section>

      <Section title="The rubric reviewers use">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Criterion</th>
              <th className={thNum}>Weight</th>
              <th className={th}>What it means</th>
            </tr>
          </thead>
          <tbody>
            {researchRubric.map((r) => (
              <tr key={r.criterion}>
                <td className={td}>
                  <span className="font-medium text-wows-ink">
                    {r.criterion}
                  </span>
                </td>
                <td className={tdNum}>{r.weight}</td>
                <td className={td}>
                  <span className="text-wows-muted">{r.body}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Section>

      <Callout>
        <p className="text-[12.5px] leading-relaxed text-wows-muted">
          Every published note carries the educational disclaimer automatically,
          and it cannot be removed by the author. A note that frames a price
          target as an instruction is returned; the flag on this queue is a
          lint, not a judgement, and a human still reads it.
        </p>
      </Callout>
    </main>
  );
}

function Queue({
  items,
  showActions,
}: {
  items: typeof reviewQueue;
  showActions: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-[15px] text-wows-muted">
        Nothing here. An empty queue in week three is normal; it is week ten
        with an empty queue that is a problem.
      </p>
    );
  }
  return (
    <ul className="flex flex-col border-t border-wows-rule">
      {items.map((r) => (
        <li key={r.id} className="border-b border-wows-rule py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h3 className="max-w-prose text-[15px] font-semibold text-wows-ink">
                {r.title}
              </h3>
              <p className="numeric mt-1 text-xs text-wows-muted">
                {memberById(r.authorId).name} · {r.vertical} · {r.words} words ·
                submitted <When iso={r.submittedAt} withTime={false} />
                {r.reviewer ? ` · reviewer ${r.reviewer}` : ""}
              </p>
            </div>
            <Chip tone={r.state === "awaiting_faculty" ? "warn" : "neutral"}>
              {r.state.replace(/_/g, " ")}
            </Chip>
          </div>

          {r.flags.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {r.flags.map((f) => (
                <li key={f}>
                  <Panel tone="accent" className="py-2">
                    <p className="text-[12.5px] text-wows-ink">{f}</p>
                  </Panel>
                </li>
              ))}
            </ul>
          ) : null}

          {showActions ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={buttonClass.primary}>
                Approve
              </button>
              <button type="button" className={buttonClass.secondary}>
                Request changes
              </button>
              <button type="button" className={buttonClass.quiet}>
                Return
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
