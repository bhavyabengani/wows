import { expect, test } from "@playwright/test";
import { EDUCATIONAL_DISCLAIMER } from "../src/lib/disclaimer";

test("placeholder page loads and shows the educational disclaimer", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("WOWS Portal");
  await expect(
    page.getByRole("heading", { level: 1, name: "Wolves of Wall Street" }),
  ).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText(
    EDUCATIONAL_DISCLAIMER,
  );
});
