import Link from "next/link";
import { Chip, PageHeader, buttonClass } from "@/components/preview/ui";
import { learnModule, learnTracks, type Block } from "@/preview-data";

export function generateStaticParams() {
  return learnTracks.flatMap((t) => t.modules.map((m) => ({ slug: m.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = learnTracks
    .flatMap((t) => t.modules)
    .find((m) => m.slug === slug);
  return { title: mod ? mod.title : learnModule.title };
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

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const track = learnTracks.find((t) => t.modules.some((m) => m.slug === slug));
  const mod = track?.modules.find((m) => m.slug === slug);
  const isSample = slug === learnModule.slug;
  const title = mod?.title ?? learnModule.title;
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={title}
        lede={
          <>
            {track?.name ?? learnModule.track} ·{" "}
            {mod?.minutes ?? learnModule.minutes} min ·{" "}
            {isSample ? learnModule.position : "Sample content shown below"}
          </>
        }
        aside={
          <Link href="/learn" className={buttonClass.secondary}>
            All modules
          </Link>
        }
      />
      {mod?.quant ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-wows-rule bg-wows-surface p-4">
          <div>
            <p className="font-medium text-wows-ink">Hands-on module</p>
            <p className="text-sm text-wows-muted">
              Opens in the club&apos;s Python environment, a separate app. Your
              progress is recorded here when you finish.
            </p>
          </div>
          <a href="#" className={buttonClass.primary}>
            Open in the Python environment
          </a>
        </div>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <article>
          <Body blocks={learnModule.body} />
        </article>
        <aside className="flex flex-col gap-4 text-sm">
          <div>
            <p className="text-xs text-wows-muted">Status</p>
            <div className="mt-1">
              <Chip tone={mod?.status === "done" ? "positive" : "neutral"}>
                {mod?.status === "done"
                  ? "Completed"
                  : mod?.status === "in_progress"
                    ? "In progress"
                    : "Not started"}
              </Chip>
            </div>
          </div>
          <div>
            <p className="text-xs text-wows-muted">Further reading</p>
            <ul className="mt-1 flex flex-col gap-1">
              {learnModule.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-wows-accent-soft underline underline-offset-4"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs text-wows-muted">Approved by</p>
            <p className="text-wows-ink">Faculty advisor, 6 Sep 2026</p>
          </div>
          <button type="button" className={`${buttonClass.primary} mt-2`}>
            Mark as complete
          </button>
        </aside>
      </div>
    </main>
  );
}
