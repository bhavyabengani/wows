/**
 * The simulation engine's public surface.
 *
 * A pure, deterministic, server-side library. It has no knowledge of HTTP,
 * React, Next.js or the database: prices arrive through an injected accessor,
 * time arrives as an argument, and randomness arrives as seeded state. The
 * boundary is enforced by `src/engine/architecture.test.ts`, which fails if
 * anything in here reaches back into the app.
 *
 * The rules that govern behaviour live in docs/ENGINE_RULES.md rather than in
 * comments scattered through the code, so that a rule can be read, argued
 * with, and cited without opening a file of TypeScript.
 */
export * from "./types";
export * from "./money";
export * from "./prng";
export * from "./config";
export * from "./prices";
export * from "./ledger";
export * from "./run";
export * from "./counterfactuals";
export * from "./behaviour";
export * from "./serialise";
