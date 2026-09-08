import { PageHeader } from "@/components/preview/ui";
import { EventList } from "./list";

export const metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Events"
        lede="Sessions, workshops and guest talks this season. RSVP so the room fits; attendance counts toward Contribution."
      />
      <EventList />
    </main>
  );
}
