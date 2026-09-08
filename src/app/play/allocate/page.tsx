import Link from "next/link";
import {
  PageHeader,
  SimulationDisclaimer,
  buttonClass,
} from "@/components/preview/ui";
import { AllocationStep } from "./step";

export const metadata = { title: "Allocation game" };

export default function AllocatePage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Allocation game"
        lede="One week of a historical replay at a time. Set the mix, read the news, advance. Your run is saved after every step."
        aside={
          <Link href="/play/allocate/debrief" className={buttonClass.secondary}>
            See a finished run&apos;s debrief
          </Link>
        }
      />
      <SimulationDisclaimer />
      <AllocationStep />
    </main>
  );
}
