import { KioskRunner } from "./runner";

export const metadata = { title: "Quiz kiosk" };

/**
 * Kiosk mode: the stall version, for orientation week. It is a sandbox —
 * nothing entered here touches a member account (H3). In the real product
 * this route replaces the member shell entirely and runs full-screen on a
 * borrowed laptop; in the preview the shell stays so the banner and the
 * footer disclaimer remain visible on every route.
 */
export default function KioskPage() {
  return (
    <main className="flex flex-col gap-6">
      <KioskRunner />
    </main>
  );
}
