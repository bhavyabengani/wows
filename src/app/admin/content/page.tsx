import {
  Callout,
  Chip,
  PageHeader,
  Panel,
  Section,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { adminContent, type AdminContentItem } from "@/preview-data";
import { AdminNav } from "../nav";

export const metadata = { title: "Admin — content" };

const KINDS: AdminContentItem["kind"][] = [
  "Forecast question",
  "Curriculum module",
  "Quiz bank",
  "News card",
];

const TONE: Record<
  AdminContentItem["state"],
  "neutral" | "accent" | "positive" | "warn"
> = {
  draft: "neutral",
  in_review: "warn",
  published: "positive",
  voided: "accent",
};

export default function AdminContentPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Content"
        lede="Forecast questions, curriculum modules, quiz banks and news cards. Everything here carries a publication state, and the ones members are scored on carry a gate as well."
      />
      <AdminNav />

      <Panel tone="accent">
        <h2 className="text-[15px] font-semibold text-wows-ink">
          Writing a forecast question
        </h2>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          A question must name an observable, name the source that will settle
          it, and give a resolution date — all three before it opens. That is
          what makes it a forecast rather than an opinion poll, and it is why
          the template refuses “Is Reliance a good buy at current levels?”
          rather than leaving it to a reviewer to catch. Resolution criteria are
          written before the outcome is known; once a question opens or takes
          its first answer, the prompt and criteria lock.
        </p>
      </Panel>

      {KINDS.map((kind) => {
        const items = adminContent.filter((c) => c.kind === kind);
        return (
          <Section
            key={kind}
            title={kind}
            action={
              <button type="button" className={buttonClass.quiet}>
                New
              </button>
            }
          >
            <ul className="flex flex-col border-t border-wows-rule">
              {items.map((c) => (
                <li key={c.id} className="border-b border-wows-rule py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="max-w-prose text-[15px] font-semibold text-wows-ink">
                      {c.title}
                    </h3>
                    <span className="flex items-center gap-2">
                      {c.gate ? <Chip tone="warn">{c.gate}</Chip> : null}
                      <Chip tone={TONE[c.state]}>
                        {c.state.replace("_", " ")}
                      </Chip>
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed text-wows-muted">
                    {c.detail}
                  </p>
                  <p className="numeric mt-1 text-xs text-wows-muted">
                    {c.author} · <When iso={c.when} withTime={false} />
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}

      <Callout>
        <h2 className="text-[15px] font-semibold text-wows-ink">
          Voiding, and why it exists
        </h2>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          Some questions become unanswerable: the event does not occur, the
          criterion turns out ambiguous, the data source changes underneath it.
          A voided question is excluded from every score{" "}
          <em className="not-italic font-medium text-wows-ink">and</em> from
          each member&rsquo;s forecast count, so it cannot quietly push someone
          below the participation threshold. The reason is shown on the question
          and the voiding is written to the audit log.
        </p>
      </Callout>

      <Callout>
        <h2 className="text-[15px] font-semibold text-wows-ink">
          News cards and hindsight
        </h2>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          A card attached to a replay step must be written only from sources
          dated on or before that step. The check is mechanical — the card
          records what it was written from, and a card whose sources postdate
          its step is rejected — because a card that knows what happened next
          turns a simulation into a quiz with the answers printed on it.
        </p>
      </Callout>
    </main>
  );
}
