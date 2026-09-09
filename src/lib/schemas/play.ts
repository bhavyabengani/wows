import { z } from "zod";

/**
 * Boundary schemas for the allocation game. Everything crossing into a route
 * handler is parsed here before it is used; nothing downstream re-checks it.
 */

/**
 * Client-generated and required (H16). A repeated key returns the original
 * result, which is what makes a double-tapped Advance harmless.
 */
const idempotencyKey = z
  .string()
  .min(8, "an idempotency key must be at least 8 characters")
  .max(200);

export const startRunSchema = z.object({
  gameInstanceId: z.string().uuid(),
  mode: z.enum(["ranked", "practice"]),
});

/**
 * Weights are whole basis points, and the server checks they total 10000. The
 * client shows the residual rather than normalising silently: a player who
 * meant 33/33/33 should be told it is 99, not quietly given 33.34.
 */
export const setWeightsSchema = z.object({
  idempotencyKey,
  weightsBps: z.record(z.string().min(1), z.number().int().min(0).max(10_000)),
});

export const previewSchema = z.object({
  weightsBps: z.record(z.string().min(1), z.number().int().min(0).max(10_000)),
});

export const advanceSchema = z.object({ idempotencyKey });

export type StartRunInput = z.infer<typeof startRunSchema>;
export type SetWeightsInput = z.infer<typeof setWeightsSchema>;
export type AdvanceInput = z.infer<typeof advanceSchema>;
