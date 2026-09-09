/**
 * npm run engine:rebuild-cache [-- <run-id>]
 *
 * Throws away `holdings_cache` and refolds it from the append-only ledger.
 * Nothing is lost by running this: if it ever produces a different answer,
 * the cache was wrong and the ledger was right (H13).
 */
import "./lib/load-env";
import { rebuildHoldingsCache } from "@/db/holdings-cache";
import { createSystemDb } from "@/db/system";

async function main(): Promise<void> {
  const runId = process.argv[2];
  const { db, close } = createSystemDb();
  try {
    const summary = await rebuildHoldingsCache(db, runId);
    console.log(
      `Rebuilt holdings for ${summary.runs} run(s): ${summary.rows} row(s), ` +
        `folded from the ledger.`,
    );
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
