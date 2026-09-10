import { desc, eq } from "drizzle-orm";
import { withUser } from "@/db/client";
import { gameInstances, scenarios, seasons } from "@/db/schema";
import { authErrorResponse, requireRole } from "@/lib/auth";

/**
 * GET /api/play/games — the open game, if there is one.
 *
 * Only what a player is allowed to know before starting: which game, and what
 * it is called. Nothing about the scenario's seed, its schedule or its shock.
 */
export async function GET() {
  try {
    const user = await requireRole(["member", "lead", "core"]);
    const game = await withUser(user.id, async (tx) => {
      const rows = await tx
        .select({
          gameInstanceId: gameInstances.id,
          scenarioName: scenarios.name,
          scenarioVersion: scenarios.version,
        })
        .from(gameInstances)
        .innerJoin(scenarios, eq(scenarios.id, gameInstances.scenarioId))
        .innerJoin(seasons, eq(seasons.id, gameInstances.seasonId))
        .where(eq(seasons.state, "open"))
        .orderBy(desc(gameInstances.opensAt))
        .limit(1);
      return rows[0] ?? null;
    });
    return Response.json(game ?? {}, { status: 200 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    return Response.json({ error: "Could not read games" }, { status: 500 });
  }
}
