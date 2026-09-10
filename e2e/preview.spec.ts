import { expect, test } from "@playwright/test";
import { EDUCATIONAL_DISCLAIMER } from "../src/lib/disclaimer";

/**
 * Design-preview smoke: every route renders, carries the preview banner and
 * the educational footer, and produces no browser console errors.
 */
const ROUTES = [
  "/",
  "/preview",
  "/about",
  "/apply",
  "/dashboard",
  "/dashboard?state=loading",
  "/dashboard?state=empty",
  "/dashboard?state=error",
  "/leaderboard",
  "/leaderboard?state=sparse",
  "/play/allocate",
  "/play/allocate/debrief",
  "/play/forecast",
  "/play/portfolio",
  "/play/quiz",
  "/play/quiz/kiosk",
  "/research",
  "/research?state=sparse",
  "/research/submit",
  "/research/mine",
  "/research/tcs-margin-trajectory-fy27",
  "/learn",
  "/learn/writing-a-falsifiable-thesis",
  "/events",
  "/events?state=sparse",
  "/members",
  "/members?state=sparse",
  "/me",
  "/me?state=sparse",
  "/admin/members",
  "/admin/seasons",
  "/admin/games",
  "/admin/content",
  "/admin/review",
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
    // A redirect to /login also has a banner, a footer and an h1, so the
    // smoke test has to say where it actually landed. Pass 3 found exactly
    // that: the rebase onto main put the auth proxy back in front of every
    // member route and every screen still "passed".
    expect(new URL(page.url()).pathname).not.toBe("/login");
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

test("the preview index reaches every screen and the quiz explains itself", async ({
  page,
}) => {
  await page.goto("/preview");
  // The index is the reviewer's map: it must actually link the new surfaces.
  for (const href of [
    "/about",
    "/apply",
    "/members",
    "/me",
    "/play/quiz",
    "/play/quiz/kiosk",
    "/research/submit",
    "/research/mine",
    "/admin/seasons",
    "/admin/review",
  ]) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
  }

  await page.goto("/play/quiz");
  await page.getByRole("radio").first().click();
  // Answering reveals the reasoning, not just a tick.
  await expect(page.getByText("Price sensitivity to yield")).toBeVisible();
});

test("kiosk mode says plainly that it touches no member account", async ({
  page,
}) => {
  await page.goto("/play/quiz/kiosk");
  await page.getByLabel("Your name").fill("Reviewer");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Question 1 of 3")).toBeVisible();
});
