import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";

/**
 * Captures docs/screenshots for the design preview. Not part of the normal
 * run: `SCREENSHOTS=before npm run test:e2e -- e2e/screenshots.spec.ts`.
 */
const prefix = process.env.SCREENSHOTS;
const PAGES = [
  ["dashboard", "/dashboard"],
  ["leaderboard", "/leaderboard"],
  ["allocate", "/play/allocate"],
] as const;

test.skip(!prefix, "set SCREENSHOTS=<prefix> to capture");

for (const [name, path] of PAGES) {
  for (const [size, width, height] of [
    ["desktop", 1280, 800],
    ["mobile", 375, 812],
  ] as const) {
    test(`${prefix} ${name} ${size}`, async ({ page }) => {
      mkdirSync("docs/screenshots", { recursive: true });
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `docs/screenshots/${prefix}-${name}-${size}.png`,
        fullPage: true,
      });
    });
  }
}
