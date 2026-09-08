import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Chip,
  Meta,
  PageHeader,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { EDUCATIONAL_DISCLAIMER } from "@/lib/disclaimer";
import { memberById, researchNotes, type Block } from "@/preview-data";

export function generateStaticParams() {
  return researchNotes.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const note = researchNotes.find((n) => n.slug === slug);
  return { title: note ? note.title : "Research" };
}

const STATE_LABEL = {
  published: "Published",
  in_review: "In review",
  changes_requested: "Changes requested",
} as const;

function NoteDisclaimer() {
  return (
    <p
      role="note"
      className="rounded-md border border-wows-rule bg-wows-paper px-3 py-2 text-xs leading-relaxed text-wows-muted"
    >
      Educational research by a student club member. {EDUCATIONAL_DISCLAIMER}{" "}
      This notice cannot be removed by the author.
    </p>
  );
}

function Body({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex max-w-prose flex-col gap-4 text-[15px] leading-relaxed text-wows-ink">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2 key={i} className="mt-2 text-lg font-semibold tracking-tight">
                {b.text}
              </h2>
            );
          case "p":
            return <p key={i}>{b.text}</p>;
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-wows-accent pl-4 text-wows-muted"
              >
                {b.text}
              </blockquote>
            );
        }
      })}
    </div>
  );
}

export default async function ResearchNotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const note = researchNotes.find((n) => n.slug === slug);
  if (!note) notFound();
  const author = memberById(note.authorId);
  return (
    <main className="flex flex-col gap-6">
      <NoteDisclaimer />
      <PageHeader
        title={note.title}
        lede={note.summary}
        aside={
          <Link href="/research" className={buttonClass.secondary}>
            All research
          </Link>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <article className="order-2 lg:order-1">
          <Body blocks={note.body} />
        </article>
        <aside className="order-1 flex flex-col gap-4 lg:order-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={note.state === "published" ? "positive" : "neutral"}>
              {STATE_LABEL[note.state]}
            </Chip>
            {note.stale ? <Chip tone="warn">Stale</Chip> : null}
          </div>
          <Meta
            items={[
              { label: "Company", value: `${note.company} (${note.ticker})` },
              { label: "Vertical", value: note.vertical },
              { label: "Author", value: `${author.name}, ${author.cohort}` },
              { label: "Published", value: <When iso={note.publishedAt} /> },
            ]}
          />
          <div className="border-t border-wows-rule pt-3 text-sm">
            <p className="text-xs text-wows-muted">Thesis</p>
            <p className="mt-0.5 text-wows-ink">{note.thesis}</p>
          </div>
          <div className="text-sm">
            <p className="text-xs text-wows-muted">Risks</p>
            <ul className="mt-0.5 list-disc pl-5 text-wows-ink">
              {note.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="text-sm">
            <p className="text-xs text-wows-muted">Falsifier</p>
            <p className="mt-0.5 text-wows-ink">{note.falsifier}</p>
          </div>
          <div className="text-sm">
            <p className="text-xs text-wows-muted">Sources</p>
            {note.sources.length ? (
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {note.sources.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      className="text-wows-accent-soft underline underline-offset-4"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-0.5 text-wows-muted">None listed yet.</p>
            )}
          </div>
        </aside>
      </div>
      <NoteDisclaimer />
    </main>
  );
}
