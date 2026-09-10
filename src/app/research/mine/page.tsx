import Link from "next/link";
import {
  Callout,
  Chip,
  PageHeader,
  Panel,
  Section,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { myNotes, type MyNote } from "@/preview-data";

export const metadata = { title: "My research" };

const STATE_LABEL: Record<MyNote["state"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In review",
  changes_requested: "Changes requested",
  published: "Published",
};

const STATE_TONE: Record<
  MyNote["state"],
  "neutral" | "accent" | "positive" | "warn"
> = {
  draft: "neutral",
  submitted: "neutral",
  in_review: "warn",
  changes_requested: "accent",
  published: "positive",
};

/** The workflow, in the order a note travels through it. */
const ORDER: MyNote["state"][] = [
  "changes_requested",
  "in_review",
  "submitted",
  "draft",
  "published",
];

export default function MyResearchPage() {
  const sorted = [...myNotes].sort(
    (a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state),
  );

  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="My research"
        lede="Everything you have written, in whatever state it is in. Only published notes are visible to anyone else."
        aside={
          <Link href="/research/submit" className={buttonClass.primary}>
            New note
          </Link>
        }
      />

      <Section title="Notes">
        <ul className="flex flex-col border-t border-wows-rule">
          {sorted.map((n) => (
            <li key={n.id} className="border-b border-wows-rule py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-wows-ink">
                    {n.state === "published" ? (
                      <Link
                        href="/research/tcs-margin-trajectory-fy27"
                        className="underline decoration-wows-rule underline-offset-4"
                      >
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </h3>
                  <p className="numeric mt-1 text-xs text-wows-muted">
                    {n.ticker} · {n.words} words · last edited{" "}
                    <When iso={n.updatedAt} />
                    {n.reviewer ? ` · reviewer ${n.reviewer}` : ""}
                  </p>
                </div>
                <Chip tone={STATE_TONE[n.state]}>{STATE_LABEL[n.state]}</Chip>
              </div>

              {n.state === "changes_requested" && n.comments ? (
                <div className="mt-4 flex flex-col gap-3">
                  <p className="text-[12.5px] font-medium text-wows-ink">
                    {n.comments.length} comments against the rubric
                  </p>
                  {n.comments.map((c, i) => (
                    <Callout key={i}>
                      <p className="text-[12.5px] text-wows-muted">
                        <span className="font-semibold text-wows-ink">
                          {c.author}
                        </span>{" "}
                        on {c.criterion} · <When iso={c.at} />
                      </p>
                      <p className="mt-1 max-w-prose text-[15px] leading-relaxed text-wows-ink">
                        {c.body}
                      </p>
                    </Callout>
                  ))}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/research/submit"
                      className={buttonClass.secondary}
                    >
                      Revise and resubmit
                    </Link>
                  </div>
                </div>
              ) : null}

              {n.state === "in_review" ? (
                <p className="mt-2 text-[12.5px] text-wows-muted">
                  With {n.reviewer}. You cannot edit a note while it is being
                  read; revisions create a new version rather than changing the
                  one under review.
                </p>
              ) : null}

              {n.state === "draft" ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href="/research/submit"
                    className={buttonClass.secondary}
                  >
                    Continue writing
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Panel>
        <h2 className="text-[15px] font-semibold text-wows-ink">
          How the workflow runs
        </h2>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          Draft → submitted → in review → published, with changes requested as
          the loop back. A published note is never edited in place: a correction
          is a new revision, and the note shows which revision you are reading.
          Curriculum modules carry an extra gate that only the faculty adviser
          can pass.
        </p>
      </Panel>
    </main>
  );
}
