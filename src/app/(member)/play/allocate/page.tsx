import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { withUser } from "@/db/client";
import { gameInstances, runs, scenarios, seasons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  currentPortfolio,
  currentQuotes,
  loadRun,
} from "@/lib/runs/repository";
import { toRunView } from "@/lib/runs/view";
import { AllocateScreen } from "./screen";
import { StartRun } from "./start";

export const metadata = { title: "Allocation game — WOWS Portal" };
export const dynamic = "force-dynamic";

/**
 * The run screen. A server component, so the only thing that reaches the
 * browser is the view built by `toRunView`, which carries the current step and
 * nothing beyond it (H15).
 *
 * Loading is `loading.tsx`, errors are `error.tsx` (a throw surfaces there, so
 * a failure is never rendered as success, H34), and the empty state is the
 * "no game open" block below.
 */
export default async function AllocatePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const requested = (await searchParams).run;

  const data = await withUser(user.id, async (tx) => {
    const games = await tx
      .select({
        id: gameInstances.id,
        scenarioName: scenarios.name,
        scenarioVersion: scenarios.version,
        state: gameInstances.state,
      })
      .from(gameInstances)
      .innerJoin(scenarios, eq(scenarios.id, gameInstances.scenarioId))
      .innerJoin(seasons, eq(seasons.id, gameInstances.seasonId))
      .where(eq(seasons.state, "open"))
      .orderBy(desc(gameInstances.opensAt))
      .limit(1);
    const game = games[0] ?? null;

    // Resume the requested run, else the member's most recent unfinished one.
    let runId = requested ?? null;
    if (runId === null && game !== null) {
      const existing = await tx
        .select({ id: runs.id })
        .from(runs)
        .where(
          and(
            eq(runs.userId, user.id),
            eq(runs.gameInstanceId, game.id),
            eq(runs.state, "in_progress"),
          ),
        )
        .orderBy(desc(runs.startedAt))
        .limit(1);
      runId = existing[0]?.id ?? null;
    }

    if (runId === null) return { game, view: null } as const;

    const loaded = await loadRun(tx, runId, user.id);
    const portfolio = await currentPortfolio(tx, loaded);
    const quotes = await currentQuotes(tx, loaded);
    return {
      game,
      view: toRunView({ ...loaded, portfolio, quotes }),
    } as const;
  });

  if (data.view === null) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-wows-ink">
          Allocation game
        </h1>
        {data.game === null ? (
          <p className="mt-3 max-w-prose text-sm text-wows-muted">
            No game is open right now. The core team opens one at the start of
            each season; until then there is nothing to play here.
          </p>
        ) : (
          <StartRun
            gameInstanceId={data.game.id}
            scenarioName={`${data.game.scenarioName} v${data.game.scenarioVersion}`}
          />
        )}
      </main>
    );
  }

  return <AllocateScreen initial={data.view} />;
}
