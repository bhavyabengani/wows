import { withUser } from "@/db/client";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { requestLogger } from "@/lib/log";
import { REBALANCE_LIMIT, consume, tooManyRequests } from "@/lib/rate-limit";
import { setWeightsSchema } from "@/lib/schemas/play";
import {
  RunError,
  currentPortfolio,
  currentQuotes,
  loadRun,
  rebalance,
} from "@/lib/runs/repository";
import { toRunView } from "@/lib/runs/view";

/**
 * POST /api/play/runs/:runId/rebalance — set target weights.
 *
 * The engine converts weights to orders and fills them at this step's close.
 * An invalid set of weights comes back as a stated rejection, never as a
 * silently normalised allocation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const log = await requestLogger({ route: "play.runs.rebalance" });
  try {
    const user = await requireRole(["member", "lead", "core"]);
    const { runId } = await params;
    const parsed = setWeightsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const outcome = await withUser(user.id, async (tx) => {
      const limit = await consume(
        tx,
        `${user.id}:rebalance`,
        REBALANCE_LIMIT,
        new Date(),
      );
      if (!limit.allowed) return { kind: "limited", limit } as const;

      const loaded = await loadRun(tx, runId, user.id);
      const result = await rebalance(tx, loaded, {
        type: "set_target_weights",
        idempotencyKey: parsed.data.idempotencyKey,
        weightsBps: parsed.data.weightsBps,
      });
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
      log.info("rebalance rejected", { code: outcome.rejection.code });
      return Response.json(
        { error: outcome.rejection.message, code: outcome.rejection.code },
        { status: 422 },
      );
    }

    log.info("rebalanced", { runId, replayed: outcome.replayed });
    return Response.json(outcome.view, { status: 200 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof RunError && error.code === "not_found") {
      return Response.json({ error: "No such run" }, { status: 404 });
    }
    log.error("rebalance failed", { error });
    return Response.json(
      {
        error: "The rebalance was not saved",
        detail: "Nothing changed. Your allocation is as it was; try again.",
      },
      { status: 500 },
    );
  }
}
