import { withUser } from "@/db/client";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { requestLogger } from "@/lib/log";
import { startRunSchema } from "@/lib/schemas/play";
import {
  RunError,
  currentPortfolio,
  currentQuotes,
  startRun,
} from "@/lib/runs/repository";
import { toRunView } from "@/lib/runs/view";

/**
 * POST /api/play/runs — start a run.
 *
 * Role is checked server-side (H1). A ranked attempt is refused if the member
 * already has one against this scenario version; that is the one-attempt rule
 * and it is enforced here, not by hiding a button.
 */
export async function POST(request: Request) {
  const log = await requestLogger({ route: "play.runs.start" });
  try {
    const user = await requireRole(["member", "lead", "core"]);
    const parsed = startRunSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const view = await withUser(user.id, async (tx) => {
      const loaded = await startRun(tx, {
        userId: user.id,
        gameInstanceId: parsed.data.gameInstanceId,
        mode: parsed.data.mode,
      });
      const portfolio = await currentPortfolio(tx, loaded);
      const quotes = await currentQuotes(tx, loaded);
      return toRunView({ ...loaded, portfolio, quotes });
    });

    log.info("run started", { runId: view.runId, mode: view.mode });
    return Response.json(view, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof RunError && error.code === "already_ranked") {
      return Response.json(
        {
          error: "Ranked attempt already used",
          detail:
            "You have already played this scenario for the leaderboard. You can start a practice run instead; practice runs are unlimited and never ranked.",
        },
        { status: 409 },
      );
    }
    log.error("run start failed", { error });
    return Response.json({ error: "Could not start the run" }, { status: 500 });
  }
}
