import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

/**
 * The allocation game, end to end.
 *
 * Two things are being proved. First, the flow the brief says must never
 * break: start, rebalance, advance, lose the browser, come back, finish, and
 * reach the debrief. Second, and more important, that no future data ever
 * reaches the browser (H15) — asserted against the network, not against the
 * code, because reading the code is exactly how that requirement gets broken.
 *
 * Requires `npm run db:reset && npm run db:load-snapshot -- v1`.
 */

const MEMBER = "rohan.chatterjee_ug27@ashoka.edu.in";
const RANKED_MEMBER = "tara.banerjee_ug27@ashoka.edu.in";
const NETWORK_MEMBER = "nisha.pillai_ug27@ashoka.edu.in";
const DOUBLE_TAP_MEMBER = "yash.agarwal_ug27@ashoka.edu.in";

test.describe.configure({ mode: "serial" });

test("a run survives a closed browser and reaches the debrief", async ({
  page,
  request,
}) => {
  test.setTimeout(600_000);

  const browserErrors: string[] = [];
  page.on("pageerror", (error) =>
    browserErrors.push(`pageerror: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      browserErrors.push(`console: ${message.text()}`);
  });

  await signIn(page, request, MEMBER);
  await page.goto("/play/allocate");

  // Start a practice run. Ranked is the one attempt that counts, and a test
  // must not spend it. On a freshly seeded database the start screen is what
  // loads; on a re-run against a database that already has an unfinished run,
  // the screen resumes it instead, and the flow under test is the same either
  // way.
  await startOrResume(page);
  await expect(page.getByTestId("run-mode")).toContainText("Practice");
  const startingStep = Number(await page.getByTestId("run-step").innerText());
  expect(startingStep).toBe(0);

  // The disclaimer is inside the simulation screen, not only in the footer.
  await expect(page.getByRole("note")).toContainText("no real money");

  const runUrl = page.url();

  // Set an allocation. The total must read 100% before it can be applied.
  await page.getByLabel("NIFTYBEES target weight").fill("4000");
  await page.getByLabel("GOLDBEES target weight").fill("2000");
  await page.getByLabel("LTGILTBEES target weight").fill("2000");
  await page.getByLabel("CASH target weight").fill("2000");
  await expect(page.getByTestId("weight-total")).toHaveText("100%");
  await page.getByTestId("rebalance").click();
  await expect(page.getByTestId("run-error")).toHaveCount(0);

  // Advance a few steps.
  for (let step = 1; step <= 3; step += 1) {
    await page.getByTestId("advance").click();
    await expect(page.getByTestId("run-step")).toHaveText(String(step), {
      timeout: 30_000,
    });
  }

  const valueBefore = await page.getByTestId("portfolio-value").innerText();
  const dateBefore = await page.getByTestId("replay-date").innerText();

  // Close the browser mid-run and come back. Nothing may be lost (H18).
  await page.context().clearCookies({ name: "sb-127-auth-token" });
  await page.goto("about:blank");
  await signIn(page, request, MEMBER);
  await page.goto(runUrl);

  await expect(page.getByTestId("run-step")).toHaveText("3");
  await expect(page.getByTestId("portfolio-value")).toHaveText(valueBefore);
  await expect(page.getByTestId("replay-date")).toHaveText(dateBefore);

  // Play the rest out through the API, which is the same path the button
  // takes; driving 56 clicks would test the button, not the game.
  const runId = new URL(runUrl).searchParams.get("run");
  expect(runId).not.toBeNull();
  if (runId === null) throw new Error("the run screen carried no run id");
  for (let step = 4; step <= 59; step += 1) {
    const response = await advanceOnce(page, runId, `e2e-advance-${step}`);
    expect(response, `advance to step ${step}`).toBe(200);
  }

  await page.goto(`/play/allocate/debrief?run=${runId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Debrief",
  );

  // The lead figure is the gap against doing nothing, not the corpus.
  await expect(page.getByTestId("gap-to-did-nothing")).toBeVisible();
  await expect(page.getByTestId("final-corpus")).toBeVisible();
  await expect(page.getByTestId("finding")).not.toBeEmpty();
  await expect(page.getByTestId("shock-line")).toContainText(
    "unplanned expense",
  );

  // Display honesty: the caveats are on the screen, not in a maintainer's head.
  await expect(page.locator("main")).toContainText("price-return");
  await expect(page.locator("main")).toContainText(
    "adjusted for corporate actions",
  );

  expect(browserErrors).toEqual([]);
});

test("a double-tapped advance moves one step, not two", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  // Its own member: the rate limit is counted per member, and this test must
  // not inherit the previous one's window.
  await signIn(page, request, DOUBLE_TAP_MEMBER);
  await page.goto("/play/allocate");
  await startOrResume(page);

  const runId = new URL(page.url()).searchParams.get("run");
  expect(runId).not.toBeNull();

  // The same key twice, at once: exactly what a double tap sends.
  const key = `e2e-double-${Date.now()}`;
  const [first, second] = await Promise.all([
    page.request.post(`/api/play/runs/${runId}/advance`, {
      data: { idempotencyKey: key },
    }),
    page.request.post(`/api/play/runs/${runId}/advance`, {
      data: { idempotencyKey: key },
    }),
  ]);

  // Neither is a server error, and whichever succeeded reports one step.
  expect(first.status()).toBeLessThan(500);
  expect(second.status()).toBeLessThan(500);
  const bodies = await Promise.all(
    [first, second].map(async (response) =>
      response.status() === 200
        ? ((await response.json()) as { step: number })
        : null,
    ),
  );
  const steps = bodies
    .filter((body): body is { step: number } => body !== null)
    .map((body) => body.step);
  expect(steps.length).toBeGreaterThan(0);
  expect(new Set(steps).size).toBe(1);
  expect(steps[0]).toBe(1);

  // And the run itself is at step 1, not 2.
  await page.reload();
  await expect(page.getByTestId("run-step")).toHaveText("1");
});

test("a second ranked attempt is refused by the server", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await signIn(page, request, RANKED_MEMBER);
  await page.goto("/play/allocate");
  await expect(page.getByTestId("start-run")).toBeVisible({ timeout: 60_000 });

  const gameInstanceId = await page
    .getByTestId("start-run")
    .getAttribute("data-game-instance");
  expect(gameInstanceId).not.toBeNull();

  const first = await page.request.post("/api/play/runs", {
    data: { gameInstanceId, mode: "ranked" },
  });
  expect(first.status()).toBe(201);

  // The rule is one ranked attempt per scenario version, and it is enforced on
  // the server rather than by hiding a button.
  const second = await page.request.post("/api/play/runs", {
    data: { gameInstanceId, mode: "ranked" },
  });
  expect(second.status()).toBe(409);
  const body = (await second.json()) as { error: string; detail?: string };
  expect(body.error).toMatch(/ranked/i);
  expect(body.detail).toMatch(/practice/i);

  // Practice remains available afterwards.
  const practice = await page.request.post("/api/play/runs", {
    data: { gameInstanceId, mode: "practice" },
  });
  expect(practice.status()).toBe(201);
});

test("no future price, news card or seed ever reaches the browser (H15)", async ({
  page,
  request,
}) => {
  test.setTimeout(300_000);
  await signIn(page, request, NETWORK_MEMBER);
  await page.goto("/play/allocate");
  await expect(page.getByTestId("start-run")).toBeVisible({ timeout: 60_000 });

  // Every response the browser receives during the run is captured. The
  // assertion is on dates rather than field names, so a refactor that renames
  // a property cannot quietly turn this test off.
  const payloads: { url: string; body: string }[] = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/play") && !url.includes("/api/play")) return;
    const type = response.headers()["content-type"] ?? "";
    if (!/json|html|javascript|text/.test(type)) return;
    try {
      payloads.push({ url, body: await response.text() });
    } catch {
      // A body that cannot be read cannot leak anything either.
    }
  });

  await page.getByTestId("start-run").click();
  await expect(page.getByTestId("run-step")).toHaveText("0", {
    timeout: 30_000,
  });

  for (let step = 1; step <= 4; step += 1) {
    await page.getByTestId("advance").click();
    await expect(page.getByTestId("run-step")).toHaveText(String(step), {
      timeout: 30_000,
    });
  }

  // The date now on screen is the furthest the player is entitled to see.
  const currentDate = await page.getByTestId("replay-date").innerText();
  const currentIso = await page.evaluate(() => {
    const element = document.querySelector('[data-testid="replay-date"]');
    return element?.textContent ?? "";
  });
  expect(currentIso).not.toBe("");

  // Any ISO date in any payload must be on or before the current step's date.
  // The run window is 2019-2023, so only dates in that range are candidates.
  const asOf = new Date(`${await currentStepIso(page)}T00:00:00Z`).getTime();
  const offenders: string[] = [];
  for (const payload of payloads) {
    for (const match of payload.body.matchAll(
      /\b(20(?:19|2[0-3])-\d{2}-\d{2})\b/g,
    )) {
      const found = match[1];
      if (found === undefined) continue;
      if (new Date(`${found}T00:00:00Z`).getTime() > asOf) {
        offenders.push(`${found} in ${payload.url}`);
      }
    }
  }
  expect(
    offenders,
    `a payload carried a date beyond the current step (${currentDate})`,
  ).toEqual([]);

  // The seed and the shock must not be anywhere in what was sent.
  const allBodies = payloads.map((p) => p.body).join("\n");
  expect(allBodies).not.toContain("wows-first-replay-v1");
  expect(allBodies).not.toContain("shockStep");
  expect(allBodies).not.toContain("shockAmountPaise");
  expect(allBodies).not.toContain("stepDates");
  expect(payloads.length).toBeGreaterThan(0);
});

/**
 * Opens a run screen with a run in progress at step 0: either by starting one,
 * or by resuming one this member already had.
 */
async function startOrResume(
  page: import("@playwright/test").Page,
): Promise<void> {
  const start = page.getByTestId("start-run");
  // Wait for the page to render before asking which screen it is. Checking
  // visibility immediately races the dev server's first compile and always
  // answers "no".
  await expect(start.or(page.getByTestId("run-step")).first()).toBeVisible({
    timeout: 60_000,
  });
  if (await start.isVisible().catch(() => false)) {
    await start.click();
    await expect(page.getByTestId("run-step")).toHaveText("0", {
      timeout: 30_000,
    });
    return;
  }
  // A run is already open. Only step 0 is a usable starting point for this
  // test, so a partly played one is abandoned in favour of a fresh practice run.
  const step = await page.getByTestId("run-step").innerText();
  if (step === "0") return;
  const response = await page.request.post("/api/play/runs", {
    data: {
      gameInstanceId: await gameInstanceIdFrom(page),
      mode: "practice",
    },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { runId: string };
  await page.goto(`/play/allocate?run=${body.runId}`);
  await expect(page.getByTestId("run-step")).toHaveText("0");
}

/** The open game's id, read from whichever screen is showing. */
async function gameInstanceIdFrom(
  page: import("@playwright/test").Page,
): Promise<string> {
  const attribute = await page
    .getByTestId("start-run")
    .getAttribute("data-game-instance")
    .catch(() => null);
  if (attribute) return attribute;
  const probe = await page.request.get("/api/play/games");
  const body = (await probe.json()) as { gameInstanceId?: string };
  if (!body.gameInstanceId) throw new Error("no open game to play");
  return body.gameInstanceId;
}

/**
 * Advances once, waiting out the rate limit rather than working around it.
 *
 * The endpoint is limited to protect the server from a stuck client, and a
 * test that raised the limit to suit itself would be testing a configuration
 * nobody ships. Honouring `Retry-After` exercises the limiter instead.
 */
async function advanceOnce(
  page: import("@playwright/test").Page,
  runId: string,
  key: string,
): Promise<number> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await page.request.post(
      `/api/play/runs/${runId}/advance`,
      { data: { idempotencyKey: key } },
    );
    if (response.status() !== 429) return response.status();
    const wait = Number(response.headers()["retry-after"] ?? "5");
    await new Promise((resolve) =>
      setTimeout(resolve, (Number.isFinite(wait) ? wait : 5) * 1000 + 500),
    );
  }
  return 429;
}

/** The current step's date, read from the run screen, as an ISO date. */
async function currentStepIso(page: import("@playwright/test").Page) {
  const text = await page.getByTestId("replay-date").innerText();
  // "31 Mar 2019" as rendered in IST; parse it back to compare with payloads.
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const match = text.match(/(\d{1,2}) (\w{3}) (\d{4})/);
  if (!match) throw new Error(`could not parse the replay date: ${text}`);
  const [, day = "1", month = "Jan", year = "2019"] = match;
  return `${year}-${months[month] ?? "01"}-${day.padStart(2, "0")}`;
}
