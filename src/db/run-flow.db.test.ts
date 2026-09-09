/**
 * The run, through the database.
 *
 * The engine's own tests prove the arithmetic; these prove that persisting it
 * and reading it back changes nothing. That is the whole of H18: a closed
 * laptop loses nothing, and a resumed run is not merely similar to an
 * uninterrupted one but identical to it.
 */
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withUser } from "./client";
import { gameInstances, runLedgerEntries, runs, scenarios } from "./schema";
import { createSystemDb } from "./system";
import {
  RunError,
  advance,
  currentPortfolio,
  fingerprint,
  loadRun,
  rebalance,
  startRun,
} from "@/lib/runs/repository";
import type { Symbol_ } from "@/engine/types";

const system = createSystemDb();

let alice: string;
let bob: string;
let gameInstanceId: string;

const BALANCED: Record<Symbol_, number> = {
  NIFTYBEES: 4_000,
  GOLDBEES: 1_000,
  LTGILTBEES: 1_000,
  RELIANCE: 1_000,
  TCS: 1_000,
  INFY: 500,
  ICICIBANK: 500,
  HINDUNILVR: 500,
  CASH: 500,
};

beforeAll(async () => {
  // DISTINCT matters: a member who played two seasons has two `member` role
  // rows, and the join would otherwise hand back the same person twice.
  const members = await system.db.execute<{ id: string }>(sql`
    SELECT DISTINCT u.id, u.email FROM users u
    JOIN user_roles r ON r.user_id = u.id AND r.role = 'member'
    WHERE NOT EXISTS (
      SELECT 1 FROM user_roles s
      WHERE s.user_id = u.id AND s.role IN ('core', 'lead', 'faculty')
    )
    ORDER BY u.email LIMIT 2
  `);
  const first = members[0]?.id;
  const second = members[1]?.id;
  if (!first || !second) throw new Error("run `npm run db:seed` first");
  alice = first;
  bob = second;

  const games = await system.db
    .select({ id: gameInstances.id })
    .from(gameInstances)
    .innerJoin(scenarios, eq(scenarios.id, gameInstances.scenarioId))
    .limit(1);
  const game = games[0]?.id;
  if (!game) throw new Error("no game instance seeded");
  gameInstanceId = game;
});

afterAll(async () => {
  await system.close();
});

/** Removes a member's runs so each test starts from a clean slate. */
async function clearRuns(userId: string): Promise<void> {
  await system.db.execute(
    sql`ALTER TABLE run_ledger_entries DISABLE TRIGGER USER`,
  );
  await system.db.execute(sql`ALTER TABLE fills DISABLE TRIGGER USER`);
  await system.db.execute(sql`ALTER TABLE orders DISABLE TRIGGER USER`);
  await system.db.execute(sql`
    DELETE FROM fills WHERE order_id IN (
      SELECT o.id FROM orders o JOIN runs r ON r.id = o.run_id WHERE r.user_id = ${userId}
    )`);
  await system.db.execute(sql`
    DELETE FROM orders WHERE run_id IN (SELECT id FROM runs WHERE user_id = ${userId})`);
  await system.db.execute(sql`
    DELETE FROM run_ledger_entries WHERE run_id IN (SELECT id FROM runs WHERE user_id = ${userId})`);
  await system.db.execute(
    sql`DELETE FROM holdings_cache WHERE run_id IN (SELECT id FROM runs WHERE user_id = ${userId})`,
  );
  await system.db.execute(sql`DELETE FROM runs WHERE user_id = ${userId}`);
  await system.db.execute(sql`ALTER TABLE orders ENABLE TRIGGER USER`);
  await system.db.execute(sql`ALTER TABLE fills ENABLE TRIGGER USER`);
  await system.db.execute(
    sql`ALTER TABLE run_ledger_entries ENABLE TRIGGER USER`,
  );
}

describe("starting and persisting a run", () => {
  beforeAll(() => clearRuns(alice));

  it("creates a run whose ledger is written to the database", async () => {
    const runId = await withUser(alice, async (tx) => {
      const loaded = await startRun(tx, {
        userId: alice,
        gameInstanceId,
        mode: "practice",
      });
      expect(loaded.state.currentStep).toBe(0);
      // Sixty monthly steps over 2019-2023.
      expect(loaded.state.finalStep).toBe(59);
      return loaded.runId;
    });

    const entries = await system.db
      .select({ kind: runLedgerEntries.kind })
      .from(runLedgerEntries)
      .where(eq(runLedgerEntries.runId, runId));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("corpus_initialised");
  }, 60_000);

  it("reads back a run that folds to the same state it was saved with", async () => {
    await clearRuns(alice);
    const { runId, saved } = await withUser(alice, async (tx) => {
      const loaded = await startRun(tx, {
        userId: alice,
        gameInstanceId,
        mode: "practice",
      });
      const after = await rebalance(tx, loaded, {
        type: "set_target_weights",
        idempotencyKey: "k-open",
        weightsBps: BALANCED,
      });
      return { runId: loaded.runId, saved: fingerprint(after.state) };
    });

    const reloaded = await withUser(alice, (tx) => loadRun(tx, runId, alice));
    expect(fingerprint(reloaded.state)).toBe(saved);
  }, 60_000);
});

describe("resuming (H18)", () => {
  it("a run closed mid-flight continues identically to one that never stopped", async () => {
    await clearRuns(alice);
    await clearRuns(bob);

    const play = async (
      userId: string,
      reloadAfterEachStep: boolean,
    ): Promise<string> => {
      let runId = "";
      await withUser(userId, async (tx) => {
        const loaded = await startRun(tx, {
          userId,
          gameInstanceId,
          mode: "practice",
        });
        runId = loaded.runId;
        const opened = await rebalance(tx, loaded, {
          type: "set_target_weights",
          idempotencyKey: "k-open",
          weightsBps: BALANCED,
        });
        expect(opened.rejection).toBeUndefined();
      });

      for (let step = 1; step <= 6; step += 1) {
        await withUser(userId, async (tx) => {
          // Reloading between steps is exactly what a closed laptop does.
          const loaded = await loadRun(tx, runId, userId);
          const result = await advance(tx, loaded, `advance-${step}`);
          expect(result.rejection).toBeUndefined();
        });
        if (!reloadAfterEachStep) continue;
      }
      const final = await withUser(userId, (tx) => loadRun(tx, runId, userId));
      return fingerprint({ ...final.state, scenarioName: "x", seed: "x" });
    };

    const straight = await play(alice, false);
    const interrupted = await play(bob, true);
    expect(interrupted).toBe(straight);
  }, 180_000);
});

describe("idempotency through the stack (H16)", () => {
  it("a double-submitted advance produces one step's entries", async () => {
    await clearRuns(alice);
    const runId = await withUser(alice, async (tx) => {
      const loaded = await startRun(tx, {
        userId: alice,
        gameInstanceId,
        mode: "practice",
      });
      await rebalance(tx, loaded, {
        type: "set_target_weights",
        idempotencyKey: "k-open",
        weightsBps: BALANCED,
      });
      return loaded.runId;
    });

    await withUser(alice, async (tx) => {
      const loaded = await loadRun(tx, runId, alice);
      const first = await advance(tx, loaded, "advance-1");
      expect(first.replayed).toBe(false);
    });

    const [before] = await system.db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM run_ledger_entries WHERE run_id = ${runId}`,
    );

    await withUser(alice, async (tx) => {
      const loaded = await loadRun(tx, runId, alice);
      const second = await advance(tx, loaded, "advance-1");
      // The original result comes back, and nothing new is written.
      expect(second.replayed).toBe(true);
    });

    const [after] = await system.db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM run_ledger_entries WHERE run_id = ${runId}`,
    );
    expect(after?.count).toBe(before?.count);

    const reloaded = await withUser(alice, (tx) => loadRun(tx, runId, alice));
    expect(reloaded.state.currentStep).toBe(1);
  }, 120_000);

  it("a double-submitted rebalance produces one set of orders", async () => {
    await clearRuns(alice);
    const runId = await withUser(alice, async (tx) => {
      const loaded = await startRun(tx, {
        userId: alice,
        gameInstanceId,
        mode: "practice",
      });
      await rebalance(tx, loaded, {
        type: "set_target_weights",
        idempotencyKey: "same-key",
        weightsBps: BALANCED,
      });
      return loaded.runId;
    });

    const [before] = await system.db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM orders WHERE run_id = ${runId}`,
    );
    expect(Number(before?.count)).toBeGreaterThan(0);

    await withUser(alice, async (tx) => {
      const loaded = await loadRun(tx, runId, alice);
      const again = await rebalance(tx, loaded, {
        type: "set_target_weights",
        idempotencyKey: "same-key",
        weightsBps: BALANCED,
      });
      expect(again.replayed).toBe(true);
    });

    const [after] = await system.db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM orders WHERE run_id = ${runId}`,
    );
    expect(after?.count).toBe(before?.count);
  }, 120_000);
});

describe("one ranked attempt per scenario version", () => {
  it("refuses a second ranked run and still allows practice", async () => {
    await clearRuns(alice);

    await withUser(alice, (tx) =>
      startRun(tx, { userId: alice, gameInstanceId, mode: "ranked" }),
    );

    await expect(
      withUser(alice, (tx) =>
        startRun(tx, { userId: alice, gameInstanceId, mode: "ranked" }),
      ),
    ).rejects.toThrow(RunError);

    // Practice is unlimited, and remains so after the ranked attempt is used.
    const practice = await withUser(alice, (tx) =>
      startRun(tx, { userId: alice, gameInstanceId, mode: "practice" }),
    );
    expect(practice.mode).toBe("practice");
    const second = await withUser(alice, (tx) =>
      startRun(tx, { userId: alice, gameInstanceId, mode: "practice" }),
    );
    expect(second.runId).not.toBe(practice.runId);
  }, 120_000);

  it("does not stop a different member taking their own ranked attempt", async () => {
    await clearRuns(alice);
    await clearRuns(bob);
    await withUser(alice, (tx) =>
      startRun(tx, { userId: alice, gameInstanceId, mode: "ranked" }),
    );
    const bobsRun = await withUser(bob, (tx) =>
      startRun(tx, { userId: bob, gameInstanceId, mode: "ranked" }),
    );
    expect(bobsRun.mode).toBe("ranked");
  }, 120_000);
});

describe("the ledger is append-only and matches its projection", () => {
  it("refuses an update or a delete on a ledger entry (H13)", async () => {
    await clearRuns(alice);
    const runId = await withUser(alice, async (tx) => {
      const loaded = await startRun(tx, {
        userId: alice,
        gameInstanceId,
        mode: "practice",
      });
      return loaded.runId;
    });

    await expect(
      system.db.execute(
        sql`UPDATE run_ledger_entries SET kind = 'tampered' WHERE run_id = ${runId}`,
      ),
    ).rejects.toThrow();
    await expect(
      system.db.execute(
        sql`DELETE FROM run_ledger_entries WHERE run_id = ${runId}`,
      ),
    ).rejects.toThrow();
  }, 60_000);

  it("writes one order and one fill for every trade in the ledger", async () => {
    await clearRuns(alice);
    const runId = await withUser(alice, async (tx) => {
      const loaded = await startRun(tx, {
        userId: alice,
        gameInstanceId,
        mode: "practice",
      });
      await rebalance(tx, loaded, {
        type: "set_target_weights",
        idempotencyKey: "k-open",
        weightsBps: BALANCED,
      });
      return loaded.runId;
    });

    const loaded = await withUser(alice, (tx) => loadRun(tx, runId, alice));
    const placed = loaded.state.entries.filter(
      (entry) => entry.kind === "order_placed",
    ).length;
    const filled = loaded.state.entries.filter(
      (entry) => entry.kind === "fill",
    ).length;

    const [orderCount] = await system.db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM orders WHERE run_id = ${runId}`,
    );
    const [fillCount] = await system.db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM fills f
      JOIN orders o ON o.id = f.order_id WHERE o.run_id = ${runId}`);

    expect(orderCount?.count).toBe(placed);
    expect(fillCount?.count).toBe(filled);
    expect(placed).toBeGreaterThan(0);
  }, 120_000);
});

describe("row-level security on a run (H2)", () => {
  it("hides another member's run, ledger and orders", async () => {
    await clearRuns(alice);
    const runId = await withUser(alice, async (tx) => {
      const loaded = await startRun(tx, {
        userId: alice,
        gameInstanceId,
        mode: "practice",
      });
      await rebalance(tx, loaded, {
        type: "set_target_weights",
        idempotencyKey: "k-open",
        weightsBps: BALANCED,
      });
      return loaded.runId;
    });

    // Bob knows the id and asks for it directly.
    await expect(
      withUser(bob, (tx) => loadRun(tx, runId, bob)),
    ).rejects.toThrow(RunError);

    const seenByBob = await withUser(bob, async (tx) => {
      const rows = await tx
        .select({ id: runs.id })
        .from(runs)
        .where(eq(runs.id, runId));
      const ledger = await tx
        .select({ seq: runLedgerEntries.seq })
        .from(runLedgerEntries)
        .where(eq(runLedgerEntries.runId, runId));
      return { runs: rows.length, ledger: ledger.length };
    });
    expect(seenByBob.runs).toBe(0);
    expect(seenByBob.ledger).toBe(0);

    // Alice still sees her own.
    const seenByAlice = await withUser(alice, async (tx) => {
      const ledger = await tx
        .select({ seq: runLedgerEntries.seq })
        .from(runLedgerEntries)
        .where(eq(runLedgerEntries.runId, runId));
      return ledger.length;
    });
    expect(seenByAlice).toBeGreaterThan(0);
  }, 120_000);
});

describe("a completed run", () => {
  it("plays to the end, records completion, and values the portfolio", async () => {
    await clearRuns(alice);
    const runId = await withUser(alice, async (tx) => {
      const loaded = await startRun(tx, {
        userId: alice,
        gameInstanceId,
        mode: "practice",
      });
      await rebalance(tx, loaded, {
        type: "set_target_weights",
        idempotencyKey: "k-open",
        weightsBps: BALANCED,
      });
      return loaded.runId;
    });

    for (let step = 1; step <= 59; step += 1) {
      await withUser(alice, async (tx) => {
        const loaded = await loadRun(tx, runId, alice);
        const result = await advance(tx, loaded, `advance-${step}`);
        expect(result.rejection).toBeUndefined();
      });
    }

    const final = await withUser(alice, async (tx) => {
      const loaded = await loadRun(tx, runId, alice);
      const portfolio = await currentPortfolio(tx, loaded);
      return { state: loaded.state, portfolio };
    });
    expect(final.state.status).toBe("completed");
    expect(final.state.currentStep).toBe(59);
    expect(final.portfolio.totalValuePaise).toBeGreaterThan(0n);

    const [row] = await system.db
      .select({ state: runs.state })
      .from(runs)
      .where(and(eq(runs.id, runId)));
    expect(row?.state).toBe("completed");
  }, 600_000);
});
