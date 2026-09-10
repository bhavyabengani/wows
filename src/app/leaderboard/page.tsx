import { PageHeader } from "@/components/preview/ui";
import { LeaderboardTabs } from "./tabs";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const sparse = (await searchParams).state === "sparse";
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Leaderboards"
        lede="Six tracks, one season. Calibration is the default because it measures reasoning under uncertainty, not returns. Open any row to see the components behind the number."
      />
      <LeaderboardTabs sparse={sparse} />
    </main>
  );
}
