import { PageHeader } from "@/components/preview/ui";
import { EventList } from "./list";

export const metadata = { title: "Events" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const sparse = (await searchParams).state === "sparse";
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Events"
        lede="Sessions, workshops and guest talks this season. RSVP so the room fits; attendance counts toward Contribution."
      />
      <EventList sparse={sparse} />
    </main>
  );
}
