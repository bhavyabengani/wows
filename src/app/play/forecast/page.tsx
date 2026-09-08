import { PageHeader, SimulationDisclaimer } from "@/components/preview/ui";
import { ForecastList } from "./list";
import { CalibrationView } from "./calibration";

export const metadata = { title: "Forecasts" };

export default function ForecastPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Forecasts"
        lede="Observable questions, a probability from you, a resolution later. Revise until the deadline; locked after, against server time."
      />
      <SimulationDisclaimer />
      <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
        <ForecastList />
        <CalibrationView />
      </div>
    </main>
  );
}
