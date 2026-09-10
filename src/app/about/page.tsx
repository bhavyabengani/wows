import Link from "next/link";
import {
  Callout,
  Meta,
  PageHeader,
  Panel,
  Section,
  buttonClass,
} from "@/components/preview/ui";
import { about } from "@/preview-data";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="flex flex-col gap-10">
      <PageHeader
        title="About WOWS"
        lede={about.lede}
        aside={
          <Link href="/apply" className={buttonClass.primary}>
            Apply to join
          </Link>
        }
      />

      <Section title="What the club is">
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-3">
          {about.what.map((item) => (
            <div key={item.title}>
              <h3 className="text-[15px] font-semibold text-wows-ink">
                {item.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-wows-muted">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Verticals">
        <ul className="flex flex-col">
          {about.verticals.map((v) => (
            <li
              key={v.name}
              className="grid gap-2 border-b border-wows-rule py-4 sm:grid-cols-[14rem_1fr] sm:gap-8"
            >
              <div>
                <h3 className="text-[15px] font-semibold text-wows-ink">
                  {v.name}
                </h3>
                <p className="numeric mt-1 text-xs text-wows-muted">
                  {v.members} members · led by {v.lead}
                </p>
              </div>
              <p className="max-w-prose text-[15px] leading-relaxed text-wows-muted">
                {v.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Faculty oversight">
        <div className="grid gap-6 sm:grid-cols-[1fr_18rem] sm:items-start">
          <Callout>
            <p className="max-w-prose text-[15px] leading-relaxed text-wows-ink">
              {about.faculty.body}
            </p>
          </Callout>
          <Panel>
            <Meta
              items={[
                { label: "Adviser", value: about.faculty.name },
                { label: "Department", value: about.faculty.title },
              ]}
            />
          </Panel>
        </div>
      </Section>

      <Section title="What we do not do">
        <p className="mb-3 max-w-prose text-[15px] text-wows-muted">
          These are commitments the club has made to the university in writing.
          They are requirements of the product, not disclaimers appended to it.
        </p>
        <ul className="max-w-prose list-none border-t border-wows-rule">
          {about.policy.map((line) => (
            <li
              key={line}
              className="border-b border-wows-rule py-3 text-[15px] leading-relaxed text-wows-ink"
            >
              {line}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Getting in touch">
        <Meta
          items={[
            {
              label: "Email",
              value: (
                <a
                  href={`mailto:${about.contact.email}`}
                  className={buttonClass.quiet}
                >
                  {about.contact.email}
                </a>
              ),
            },
            { label: "Discord", value: about.contact.discord },
          ]}
        />
      </Section>
    </main>
  );
}
