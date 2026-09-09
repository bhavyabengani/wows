/**
 * The scenario config schema, and its validation.
 *
 * A scenario is a named, seeded, versioned config (H6). `(name, version)` is
 * unique in the database and a config is never edited in place: changing one
 * means a new version, because a leaderboard is pinned to the version that
 * produced it.
 *
 * Money arrives as decimal strings and leaves as `bigint` paise. JSON numbers
 * are IEEE doubles, so a config that wrote `500000000` for five lakh rupees
 * would be one silent edit away from losing precision; strings cannot be.
 */
import { z } from "zod";
import type { Paise } from "./money";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "5000.00" rupees becomes 500000n paise. Rejects anything finer than a paise. */
const rupeesToPaise = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "expected rupees, at most two decimal places")
  .transform((text): Paise => {
    const [whole = "0", fraction = ""] = text.split(".");
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  });

const isoDate = z.string().regex(ISO_DATE, "expected YYYY-MM-DD");

/**
 * News surfaces at the step it happened, and never says what happens next.
 *
 * H15 stops the client receiving future *data*; it has no opinion about prose,
 * and a card written in 2026 saying a crash "would go on to" recover leaks the
 * future just as effectively. Each card must be written from information
 * available on or before its step date; that is a review rule, recorded here
 * and in the review checklist, not something the schema can check.
 */
export const newsCardSchema = z.object({
  step: z.number().int().min(0),
  dateline: z.string().min(1),
  headline: z.string().min(1),
  body: z.string().min(1),
  source: z.string().min(1),
});

export const scenarioConfigSchema = z
  .object({
    name: z.string().min(1),
    version: z.number().int().min(1),
    seed: z.string().min(1),
    snapshotVersion: z.number().int().min(1),
    window: z.object({ start: isoDate, end: isoDate }),
    /** Monthly is the only cadence Phase 3 implements; steps land on month ends. */
    cadence: z.literal("monthly"),
    /** Symbols the player may hold. Cash is implicit and is never listed. */
    universe: z.array(z.string().min(1)).min(1),
    /** The instrument the "all index" counterfactual holds. Must be in the universe. */
    benchmarkSymbol: z.string().min(1),
    startingCorpus: rupeesToPaise,
    monthlyIncome: rupeesToPaise,
    monthlyExpense: rupeesToPaise,
    shock: z.object({
      min: rupeesToPaise,
      max: rupeesToPaise,
      label: z.string().min(1),
      /**
       * The shock falls inside the middle fraction of the run, so it never
       * lands before the player has deployed or after they can react.
       */
      windowFraction: z.number().gt(0).lte(1),
    }),
    /** Charged on every trade, each side. See docs/ENGINE_RULES.md. */
    transactionCostBps: z.number().int().min(0).max(1000),
    /** Optional: the engine runs with none, so it can be tested before content exists. */
    news: z.array(newsCardSchema).default([]),
  })
  .superRefine((config, ctx) => {
    if (config.window.end < config.window.start) {
      ctx.addIssue({ code: "custom", message: "window ends before it starts" });
    }
    if (!config.universe.includes(config.benchmarkSymbol)) {
      ctx.addIssue({
        code: "custom",
        message: `benchmark ${config.benchmarkSymbol} is not in the universe`,
      });
    }
    if (new Set(config.universe).size !== config.universe.length) {
      ctx.addIssue({ code: "custom", message: "universe repeats a symbol" });
    }
    if (config.shock.max < config.shock.min) {
      ctx.addIssue({ code: "custom", message: "shock max is below shock min" });
    }
  });

export type ScenarioConfig = z.output<typeof scenarioConfigSchema>;
export type NewsCard = z.output<typeof newsCardSchema>;

export class ScenarioConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioConfigError";
  }
}

/** Parses and validates. A malformed config fails loudly, at load, never later. */
export function parseScenarioConfig(input: unknown): ScenarioConfig {
  const result = scenarioConfigSchema.safeParse(input);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ScenarioConfigError(`invalid scenario config: ${problems}`);
  }
  return result.data;
}

/** The card for a step, if there is one. Steps without news are normal. */
export function newsForStep(
  config: ScenarioConfig,
  step: number,
): NewsCard | undefined {
  return config.news.find((card) => card.step === step);
}
