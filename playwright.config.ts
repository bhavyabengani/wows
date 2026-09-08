import { defineConfig, devices } from "@playwright/test";
import { loadLocalEnv } from "./scripts/lib/load-env";

// The dev server and the tests need the local Supabase variables.
loadLocalEnv();

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const IS_CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: IS_CI,
  // No retries: a test that only passes the second time is a failure we want
  // to see, not hide.
  retries: 0,
  reporter: IS_CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: 120_000,
  },
});
