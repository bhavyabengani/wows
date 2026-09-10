import { PageHeader } from "@/components/preview/ui";
import { ApplicationForm } from "./form";

export const metadata = { title: "Apply" };

export default function ApplyPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Apply to WOWS"
        lede="One round a semester. We read the answers, not the CV — applications are read with names removed, and the question about being wrong is the one that decides it."
      />
      <ApplicationForm />
    </main>
  );
}
