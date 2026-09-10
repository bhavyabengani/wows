"use client";

import { useState } from "react";
import { Chip, Section, When, buttonClass } from "@/components/preview/ui";
import { events, sparse as sparseData, type ClubEvent } from "@/preview-data";

export function EventList({ sparse = false }: { sparse?: boolean }) {
  // The sparse view is one event that three people have said yes to: what an
  // events page looks like in the first fortnight of a season.
  const upcoming = events.filter((e) => !e.past);
  const shown = sparse
    ? upcoming.slice(0, 1).map((e) => ({ ...e, going: sparseData.rsvps }))
    : upcoming;
  return (
    <>
      <Section title="Upcoming">
        {sparse ? (
          <p className="mb-3 max-w-prose text-[12.5px] leading-relaxed text-wows-muted">
            {sparseData.note}
          </p>
        ) : null}
        <ul className="divide-y divide-wows-rule">
          {shown.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </ul>
      </Section>
      <Section title="Past">
        {sparse ? (
          <p className="text-[15px] text-wows-muted">
            Nothing has happened yet. The first session is next week.
          </p>
        ) : (
          <ul className="divide-y divide-wows-rule">
            {events
              .filter((e) => e.past)
              .map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function EventRow({ e }: { e: ClubEvent }) {
  const [state, setState] = useState(e.state);
  const full = e.going >= e.capacity;
  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-wows-ink">{e.title}</h3>
          {state === "going" ? <Chip tone="positive">Going</Chip> : null}
          {state === "waitlisted" ? <Chip>Waitlisted</Chip> : null}
          {state === "attended" ? <Chip tone="positive">Attended</Chip> : null}
          {state === "missed" ? (
            <Chip tone="warn">RSVP&apos;d, did not attend</Chip>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-wows-muted">
          <When iso={e.startsAt} />, {e.location}
        </p>
        <p className="mt-1 text-sm text-wows-ink">{e.description}</p>
        <p className="numeric mt-1 text-xs text-wows-muted">
          {e.going} of {e.capacity} places taken
          {e.waitlist ? `, ${e.waitlist} on the waitlist` : ""}
        </p>
      </div>
      {!e.past ? (
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {state === "going" ? (
            <button
              type="button"
              onClick={() => setState("none")}
              className={buttonClass.secondary}
            >
              Cancel RSVP
            </button>
          ) : state === "waitlisted" ? (
            <button
              type="button"
              onClick={() => setState("none")}
              className={buttonClass.secondary}
            >
              Leave waitlist
            </button>
          ) : full ? (
            <button
              type="button"
              onClick={() => setState("waitlisted")}
              className={buttonClass.primary}
            >
              Join waitlist
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setState("going")}
              className={buttonClass.primary}
            >
              RSVP
            </button>
          )}
          <a
            href="#"
            className="text-xs text-wows-accent-soft underline underline-offset-4"
          >
            Add to calendar (.ics)
          </a>
        </div>
      ) : null}
    </li>
  );
}
