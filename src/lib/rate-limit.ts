/**
 * A fixed-window rate limit, counted in the database.
 *
 * The app runs on serverless instances that share no memory, so a counter in a
 * module variable would reset with every cold start and would not be a limit.
 * One upsert per request is the honest price of a limit that works.
 *
 * A fixed window can allow up to twice the limit across a boundary. That is
 * accepted: this exists to stop a stuck client hammering the advance endpoint,
 * not to meter a paid API, and a sliding window costs more than the problem.
 */
import { sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { rateLimits } from "@/db/schema";

export interface Limit {
  readonly windowSeconds: number;
  readonly max: number;
}

/** Advancing a step is deliberate; ten a minute is far above real play. */
export const ADVANCE_LIMIT: Limit = { windowSeconds: 60, max: 30 };
/** Rebalancing is cheap to preview, so the ceiling is higher. */
export const REBALANCE_LIMIT: Limit = { windowSeconds: 60, max: 60 };

export interface LimitResult {
  readonly allowed: boolean;
  readonly count: number;
  readonly max: number;
  readonly retryAfterSeconds: number;
}

/**
 * Counts one request against `bucket` and says whether it is allowed.
 *
 * The count is incremented even when the answer is no, so a client that keeps
 * pushing keeps being refused for the rest of the window rather than being let
 * through the moment it stops.
 */
export async function consume(
  tx: Tx,
  bucket: string,
  limit: Limit,
  now: Date,
): Promise<LimitResult> {
  const windowMs = limit.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

  const rows = await tx
    .insert(rateLimits)
    .values({ bucket, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  const count = rows[0]?.count ?? 1;
  const elapsed = Math.floor((now.getTime() - windowStart.getTime()) / 1000);
  return {
    allowed: count <= limit.max,
    count,
    max: limit.max,
    retryAfterSeconds: Math.max(1, limit.windowSeconds - elapsed),
  };
}

/** The 429 to return when `consume` says no. */
export function tooManyRequests(result: LimitResult): Response {
  return Response.json(
    {
      error: "Too many requests",
      detail: `You have made ${result.count} requests in this window; the limit is ${result.max}. Wait ${result.retryAfterSeconds}s and try again.`,
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}
