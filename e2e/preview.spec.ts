import { expect, test } from "@playwright/test";
import { EDUCATIONAL_DISCLAIMER } from "../src/lib/disclaimer";

/**
 * Design-preview smoke: every route renders, carries the preview banner and
 * the educational footer, and produces no browser console errors.
 */
const ROUTES = [
  "/",
  "/dashboard",
  "/dashboard?state=loading",
  "/dashboard?state=empty",
  "/dashboard?state=error",
  "/leaderboard",
  "/play/allocate",
  "/play/allocate/debrief",
  "/play/forecast",
  "/play/portfolio",
  "/research",
  "/research/tcs-margin-trajectory-fy27",
  "/learn",
  "/learn/writing-a-falsifiable-thesis",
  "/events",
  "/admin/audit",
];

for (const route of ROUTES) {
  test(`${route} renders cleanly with banner and disclaimer`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });
    await page.goto(route);
    await expect(
      page.getByRole("status").filter({ hasText: "Design preview" }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(
      EDUCATIONAL_DISCLAIMER,
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("leaderboard rows expand to their components and the bottom nav works on a phone", async ({
  page,
}) => {
  await page.goto("/leaderboard");
  await page.getByRole("button", { name: "Sara Qureshi" }).click();
  await expect(page.getByText("How this rank is built")).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  const bottomNav = page.getByRole("navigation", { name: "Primary, mobile" });
  await expect(bottomNav).toBeVisible();
  await bottomNav.getByRole("link", { name: "Events" }).click();
  await expect(page).toHaveURL(/\/events$/);
});
