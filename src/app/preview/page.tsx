import Link from "next/link";
import { PageHeader, Panel, Section } from "@/components/preview/ui";

export const metadata = { title: "Preview index" };

interface Row {
  href: string;
  label: string;
  note: string;
}

const PUBLIC: Row[] = [
  {
    href: "/",
    label: "/",
    note: "Landing page: what the club is, the four things the portal does, the no-advice policy.",
  },
  {
    href: "/about",
    label: "/about",
    note: "The club, its three verticals, faculty oversight, and what it has committed not to do.",
  },
  {
    href: "/apply",
    label: "/apply",
    note: "The application form. Submit to see the applicant's post-submission view and the review states.",
  },
  {
    href: "/research",
    label: "/research",
    note: "Published note archive with search, filters, staleness flags and review-state chips.",
  },
  {
    href: "/research/tcs-margin-trajectory-fy27",
    label: "/research/[slug]",
    note: "One published note: metadata, thesis, risks, falsifier, sources, disclaimer top and bottom.",
  },
];

const MEMBER: Row[] = [
  {
    href: "/dashboard",
    label: "/dashboard",
    note: "Standing across tracks, active game, deadlines, next event.",
  },
  {
    href: "/dashboard?state=loading",
    label: "/dashboard?state=loading",
    note: "The loading state, as a real screen rather than a spinner.",
  },
  {
    href: "/dashboard?state=empty",
    label: "/dashboard?state=empty",
    note: "A member's first day, before anything has happened.",
  },
  {
    href: "/dashboard?state=error",
    label: "/dashboard?state=error",
    note: "A failed load that says so, with a retry.",
  },
  {
    href: "/play/allocate",
    label: "/play/allocate",
    note: "One replay step: date, corpus, class weights, news, cash flows, Advance.",
  },
  {
    href: "/play/allocate/debrief",
    label: "/play/allocate/debrief",
    note: "The run against doing nothing and against the index, one behavioural finding, the timeline.",
  },
  {
    href: "/play/portfolio",
    label: "/play/portfolio",
    note: "Season positions with thesis, key risk and falsifier; the open-position gate; a closed position judged against what its author said.",
  },
  {
    href: "/play/forecast",
    label: "/play/forecast",
    note: "Open, answered and locked questions, and the reliability curve.",
  },
  {
    href: "/play/quiz",
    label: "/play/quiz",
    note: "A question, immediate feedback with the reasoning, and a run summary. Not scored.",
  },
  {
    href: "/play/quiz/kiosk",
    label: "/play/quiz/kiosk",
    note: "Kiosk mode for a recruitment stall: name entry, three questions, a score and a stall board. A sandbox that touches no member account.",
  },
  {
    href: "/leaderboard",
    label: "/leaderboard",
    note: "Six tracks, Calibration first. Rows expand to the components that built the rank.",
  },
  {
    href: "/research/submit",
    label: "/research/submit",
    note: "The submission form with the falsifier gate, and the rubric beside it.",
  },
  {
    href: "/research/mine",
    label: "/research/mine",
    note: "The author's own notes across every workflow state, with reviewer comments on one.",
  },
  {
    href: "/learn",
    label: "/learn",
    note: "Three curriculum tracks with progress.",
  },
  {
    href: "/learn/writing-a-falsifiable-thesis",
    label: "/learn/[slug]",
    note: "One module: content, links, and the Python environment on Quant modules.",
  },
  {
    href: "/events",
    label: "/events",
    note: "Upcoming and past sessions, RSVP, one at capacity with a waitlist.",
  },
  {
    href: "/members",
    label: "/members",
    note: "The directory by vertical. Deliberately no performance figures.",
  },
  {
    href: "/me",
    label: "/me",
    note: "Standing, curriculum progress, forecast history with Brier scores, published notes, attendance.",
  },
];

const ADMIN: Row[] = [
  {
    href: "/admin/members",
    label: "/admin/members",
    note: "Roster, roles, verticals, and this round's applicant review.",
  },
  {
    href: "/admin/seasons",
    label: "/admin/seasons",
    note: "The season state machine and what settling warns about before it happens.",
  },
  {
    href: "/admin/games",
    label: "/admin/games",
    note: "Scenarios, versions, game instances, and the ranked-attempt rule.",
  },
  {
    href: "/admin/content",
    label: "/admin/content",
    note: "Forecast questions, curriculum, quiz banks and news cards, each with a state and a gate.",
  },
  {
    href: "/admin/review",
    label: "/admin/review",
    note: "The research review queue, the rubric, and the faculty gate.",
  },
  {
    href: "/admin/audit",
    label: "/admin/audit",
    note: "Actor, action, entity, before, after, timestamp, reason.",
  },
];

const SPARSE: Row[] = [
  {
    href: "/members?state=sparse",
    label: "/members?state=sparse",
    note: "Six members instead of fifteen.",
  },
  {
    href: "/me?state=sparse",
    label: "/me?state=sparse",
    note: "Four resolved forecasts: below the threshold, and told so.",
  },
  {
    href: "/leaderboard?state=sparse",
    label: "/leaderboard?state=sparse",
    note: "A table with six names on it.",
  },
  {
    href: "/research?state=sparse",
    label: "/research?state=sparse",
    note: "An archive with one note in it.",
  },
  {
    href: "/events?state=sparse",
    label: "/events?state=sparse",
    note: "An event with three RSVPs.",
  },
];

function List({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <Section title={title}>
      <ul className="flex flex-col border-t border-wows-rule">
        {rows.map((r) => (
          <li
            key={r.href}
            className="grid gap-1 border-b border-wows-rule py-3 sm:grid-cols-[20rem_1fr] sm:gap-6"
          >
            <Link
              href={r.href}
              className="numeric text-sm text-wows-accent underline decoration-wows-accent/40 underline-offset-4 hover:decoration-wows-accent"
            >
              {r.label}
            </Link>
            <p className="text-[15px] leading-relaxed text-wows-muted">
              {r.note}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * The index of the review artefact. Every route in the site map is here, so a
 * reviewer never has to guess a URL.
 */
export default function PreviewIndexPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Preview index"
        lede="Every screen in the product, in one list. This page exists only in the design preview and will not ship."
      />

      <Panel tone="accent">
        <p className="max-w-prose text-[15px] leading-relaxed text-wows-muted">
          Nothing here is connected to anything. Every figure is invented sample
          data, every form discards what you type, and no page reads from a
          server. Notes on what you see go in{" "}
          <span className="numeric">docs/PREVIEW_FEEDBACK.md</span>, which is
          numbered to match these screens.
        </p>
      </Panel>

      <List title="Public" rows={PUBLIC} />
      <List title="Member" rows={MEMBER} />
      <List title="Admin" rows={ADMIN} />
      <List
        title="Sparse states — what September actually looks like"
        rows={SPARSE}
      />
    </main>
  );
}
