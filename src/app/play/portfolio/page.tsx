import { PageHeader, SimulationDisclaimer } from "@/components/preview/ui";
import { PortfolioView } from "./view";

export const metadata = { title: "Season portfolio" };

export default function PortfolioPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Season portfolio"
        lede="Your positions for Monsoon 2026, each beside the thesis you opened it with. Only you and faculty can see this page until the season settles."
      />
      <SimulationDisclaimer />
      <PortfolioView />
    </main>
  );
}
