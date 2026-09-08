import { defineConfig } from "vitest/config";

/**
 * Database-level tests (`*.db.test.ts`) run against the local Supabase
 * instance: `npm run db:start && npm run db:migrate && npm run test:db`.
 * Files run serially because they share one database.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
