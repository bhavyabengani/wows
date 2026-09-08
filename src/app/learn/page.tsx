import Link from "next/link";
import { cn } from "cn";
import { Chip, PageHeader, Section } from "@/components/preview/ui";
import { learnTracks } from "@/preview-data";

export const metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Learn"
        lede="Three tracks. Foundations first; the rest in any order. Content is approved by the faculty advisor before it appears here."
      />
      {learnTracks.map((t) => {
        const done = t.modules.filter((m) => m.status === "done").length;
        return (
          <Section
            key={t.key}
            title={t.name}
            action={
              <span className="numeric text-xs text-wows-muted">
                {done} of {t.modules.length} done
              </span>
            }
          >
            <p className="mb-3 text-sm text-wows-muted">{t.description}</p>
            <div
              className="mb-3 h-1 w-full overflow-hidden rounded-full bg-wows-rule"
              aria-hidden="true"
            >
              <div
                className="h-full bg-wows-positive"
                style={{ width: `${(done / t.modules.length) * 100}%` }}
              />
            </div>
            <ol className="divide-y divide-wows-rule">
              {t.modules.map((m, i) => (
                <li key={m.slug} className="flex items-center gap-3 py-2.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-xs",
                      m.status === "done" &&
                        "border-wows-positive bg-wows-positive text-wows-surface",
                      m.status === "in_progress" &&
                        "border-wows-accent text-wows-accent",
                      m.status === "todo" && "border-wows-rule text-wows-muted",
                    )}
                  >
                    {m.status === "done" ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/learn/${m.slug}`}
                      className="text-sm text-wows-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
                    >
                      {m.title}
                    </Link>
                    <span className="sr-only">
                      ,{" "}
                      {m.status === "done"
                        ? "completed"
                        : m.status === "in_progress"
                          ? "in progress"
                          : "not started"}
                    </span>
                  </div>
                  {m.quant ? <Chip>Python environment</Chip> : null}
                  <span className="numeric shrink-0 text-xs text-wows-muted">
                    {m.minutes} min
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        );
      })}
    </main>
  );
}
