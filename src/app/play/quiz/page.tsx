import { PageHeader, SimulationDisclaimer } from "@/components/preview/ui";
import { QuizRunner } from "./runner";

export const metadata = { title: "Quiz" };

export default function QuizPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Quiz"
        lede="Formative, not scored. Answer, see immediately whether you were right and why, and get a summary at the end. Nothing here enters a leaderboard."
      />
      <SimulationDisclaimer />
      <QuizRunner />
    </main>
  );
}
