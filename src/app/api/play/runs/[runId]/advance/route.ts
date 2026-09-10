import { withUser } from "@/db/client";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { requestLogger } from "@/lib/log";
import { ADVANCE_LIMIT, consume, tooManyRequests } from "@/lib/rate-limit";
import { advanceSchema } from "@/lib/schemas/play";
import {
  RunError,
  advance,
  currentPortfolio,
  currentQuotes,
  loadRun,
} from "@/lib/runs/repository";
import { toRunView } from "@/lib/runs/view";

/**
 * POST /api/play/runs/:runId/advance — move one step.
 *
 * The whole step lands in one transaction: the ledger entries, their
 * projection into orders and fills, and the run row (H18). A duplicate
 * idempotency key returns the original result and writes nothing (H16), which
 * is the double-tap case.
 *
 * A failure returns an error the interface shows; it never returns a body that
 * looks like a successful step (H34).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const log = await requestLogger({ route: "play.runs.advance" });
  try {
    const user = await requireRole(["member", "lead", "core"]);
    const { runId } = await params;
    const parsed = advanceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const outcome = await withUser(user.id, async (tx) => {
      const limit = await consume(
        tx,
        `${user.id}:advance`,
        ADVANCE_LIMIT,
        new Date(),
      );
      if (!limit.allowed) return { kind: "limited", limit } as const;

      const loaded = await loadRun(tx, runId, user.id);
      const result = await advance(tx, loaded, parsed.data.idempotencyKey);
      if (result.rejection !== undefined) {
        return { kind: "rejected", rejection: result.rejection } as const;
      }
      const next = { ...loaded, state: result.state };
      const portfolio = await currentPortfolio(tx, next);
      const quotes = await currentQuotes(tx, next);
      return {
        kind: "ok",
        view: toRunView({ ...next, portfolio, quotes }),
        replayed: result.replayed,
      } as const;
    });

    if (outcome.kind === "limited") return tooManyRequests(outcome.limit);
    if (outcome.kind === "rejected") {
      log.info("advance rejected", { code: outcome.rejection.code });
      return Response.json(
        { error: outcome.rejection.message, code: outcome.rejection.code },
        { status: 409 },
      );
    }

    log.info("advanced", {
      runId,
      step: outcome.view.step,
      replayed: outcome.replayed,
    });
    return Response.json(outcome.view, { status: 200 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof RunError && error.code === "not_found") {
      return Response.json({ error: "No such run" }, { status: 404 });
    }
    log.error("advance failed", { error });
    return Response.json(
      {
        error: "The step was not saved",
        detail:
          "Nothing changed. Your run is still at the step you were on; try again.",
      },
      { status: 500 },
    );
  }
}
