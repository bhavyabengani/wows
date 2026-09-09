/**
 * Reading a scenario off disk.
 *
 * File access lives here rather than in `src/engine` so the engine stays a
 * pure library: it is handed a validated config and never learns what a file
 * is. Phase 4 will read configs from the database instead and can call
 * `parseScenarioConfig` directly on the row.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseScenarioConfig, type ScenarioConfig } from "@/engine/config";

export const SCENARIO_ROOT = join(process.cwd(), "data", "scenarios");

export function scenarioDir(slug: string, version: number): string {
  return join(SCENARIO_ROOT, slug, `v${version}`);
}

/**
 * Loads `config.json`, folds in `news.json` beside it, and validates the
 * whole thing. A malformed config throws at load rather than halfway through
 * a run.
 */
export function loadScenario(slug: string, version: number): ScenarioConfig {
  const dir = scenarioDir(slug, version);
  const config = JSON.parse(
    readFileSync(join(dir, "config.json"), "utf8"),
  ) as Record<string, unknown>;

  let news: unknown = [];
  try {
    news = JSON.parse(readFileSync(join(dir, "news.json"), "utf8"));
  } catch {
    // No cards yet is a normal state; the engine runs without them.
    news = [];
  }

  return parseScenarioConfig({ ...config, news });
}
