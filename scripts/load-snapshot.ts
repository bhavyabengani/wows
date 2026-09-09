/**
 * npm run db:load-snapshot -- v1
 *
 * Loads a committed snapshot into the database in one transaction. Refuses a
 * version that is already present, and refuses a snapshot whose files no
 * longer match their manifest checksums.
 */
import "./lib/load-env";
import { loadSnapshot, SnapshotError } from "@/db/snapshot";
import { createSystemDb } from "@/db/system";

function parseVersion(argument: string | undefined): number {
  const match = /^v?(\d+)$/.exec(argument?.trim() ?? "");
  const version = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(version) || version < 1) {
    throw new SnapshotError(
      `expected a snapshot version like "v1", got ${argument ?? "nothing"}`,
    );
  }
  return version;
}

async function main(): Promise<void> {
  const version = parseVersion(process.argv[2]);
  const { db, close } = createSystemDb();
  try {
    const result = await loadSnapshot(db, version);
    console.log(
      `Loaded snapshot v${result.version}: ${result.instruments} instruments, ` +
        `${result.bars.toLocaleString()} price bars.`,
    );
    if (!result.fdSeriesVerified) {
      console.warn(
        "WARNING: the fixed-deposit rate series in this snapshot is unverified. " +
          "See docs/DATA.md before any real season uses the fixed deposit.",
      );
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
