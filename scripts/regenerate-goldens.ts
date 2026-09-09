/**
 * npm run engine:regenerate-goldens -- --confirm
 *
 * Rewrites the committed golden files from the current engine. That makes the
 * goldens agree with whatever the engine now does, which is exactly what makes
 * it dangerous: if the change was not intended, this hides it.
 *
 * So it refuses to run without `--confirm`, prints what moved, and the commit
 * message has to say why (CLAUDE.md).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  GOLDEN_DIR,
  GOLDEN_RUNS,
  computeGolden,
  goldenPath,
  renderGolden,
} from "@/lib/goldens";

function main(): void {
  if (!process.argv.includes("--confirm")) {
    console.error(
      [
        "Refusing to regenerate without --confirm.",
        "",
        "Golden files are the record of what the engine used to produce. Rewriting",
        "them makes any change to valuation, ordering or scoring look intentional,",
        "so this is a deliberate, reviewed act:",
        "",
        "  1. Know which behaviour changed, and why it should.",
        "  2. npm run engine:regenerate-goldens -- --confirm",
        "  3. Read the diff. A change you cannot explain is a bug, not a new golden.",
        "  4. Record the reason in the commit message.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  mkdirSync(GOLDEN_DIR, { recursive: true });
  let changed = 0;
  for (const golden of GOLDEN_RUNS) {
    const path = goldenPath(golden.name);
    const next = renderGolden(computeGolden(golden));
    let previous: string | null = null;
    try {
      previous = readFileSync(path, "utf8");
    } catch {
      previous = null;
    }
    writeFileSync(path, next, "utf8");
    if (previous === null) {
      console.log(`  created ${golden.name}`);
      changed += 1;
    } else if (previous !== next) {
      console.log(`  CHANGED ${golden.name} — read the diff before committing`);
      changed += 1;
    } else {
      console.log(`  unchanged ${golden.name}`);
    }
  }
  console.log(
    changed === 0
      ? "No golden changed. The engine produces what it did before."
      : `${changed} golden file(s) changed. Explain each in the commit message.`,
  );
}

main();
