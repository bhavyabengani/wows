import { PageHeader } from "@/components/preview/ui";
import { ResearchArchive } from "./archive";

export const metadata = { title: "Research" };

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const sparse = (await searchParams).state === "sparse";
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Research"
        lede="Member-written notes with a thesis, a key risk, a falsifier and sources, reviewed before publication. Educational only; never a recommendation."
      />
      <ResearchArchive sparse={sparse} />
    </main>
  );
}
