import { PageHeader } from "@/components/preview/ui";
import { SubmitForm } from "./form";

export const metadata = { title: "Submit research" };

export default function SubmitPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Submit a research note"
        lede="The structure is the point. A note that cannot be proved wrong is not a note, so the falsifier is a gate rather than a field — nothing goes to a reviewer without one."
      />
      <SubmitForm />
    </main>
  );
}
