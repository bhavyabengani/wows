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
  return loadScenarioFile(slug, version).config;
}

export interface ScenarioFile {
  readonly config: ScenarioConfig;
  /** The file's own JSON, for storing in `scenarios.config_json` unchanged. */
  readonly raw: Record<string, unknown> & { universe: string[] };
  readonly name: string;
  readonly version: number;
  readonly seed: string;
  readonly window: { start: string; end: string };
}

/**
 * Reads a scenario and returns both the validated config and the raw JSON.
 *
 * The seed stores the raw form so the database row and the committed file
 * cannot drift; the engine gets the parsed one. Validating here means a
 * malformed scenario fails at seed time rather than in the middle of a run.
 */
export function loadScenarioFile(slug: string, version: number): ScenarioFile {
  const dir = scenarioDir(slug, version);
  const raw = JSON.parse(
    readFileSync(join(dir, "config.json"), "utf8"),
  ) as Record<string, unknown> & { universe: string[] };

  let news: unknown = [];
  try {
    news = JSON.parse(readFileSync(join(dir, "news.json"), "utf8"));
  } catch {
    // No cards yet is a normal state; the engine runs without them.
    news = [];
  }

  const config = parseScenarioConfig({ ...raw, news });
  return {
    config,
    raw,
    name: config.name,
    version: config.version,
    seed: config.seed,
    window: config.window,
  };
}
