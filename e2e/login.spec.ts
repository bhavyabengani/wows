import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * The "must never break" flow: sign in with a magic link, land on the
 * dashboard, see name and role, sign out. Runs against the local Supabase
 * instance; the link is read from Mailpit, the local inbox.
 *
 * Requires `npm run db:reset` (seeded users) before running.
 */

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const MEMBER_EMAIL = "meera.iyer_ug27@ashoka.edu.in";
const MEMBER_NAME = "Meera Iyer";

interface MailpitMessage {
  ID: string;
  Created: string;
  To: { Address: string }[];
}

async function latestMagicLink(
  request: APIRequestContext,
  email: string,
  notBefore: number,
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const list = await request.get(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const body = (await list.json()) as { messages: MailpitMessage[] };
    const fresh = body.messages.find(
      (m) => new Date(m.Created).getTime() >= notBefore - 5_000,
    );
    if (fresh) {
      const msg = await request.get(`${MAILPIT}/api/v1/message/${fresh.ID}`);
      const { HTML } = (await msg.json()) as { HTML: string };
      const match = HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
      if (match?.[1]) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`no magic link for ${email} arrived in Mailpit`);
}

test("member signs in with a magic link, sees the dashboard, signs out", async ({
  page,
  request,
}) => {
  const startedAt = Date.now();
  // Any browser-side error during the flow is a failure, and its text is
  // the diagnosis.
  const browserErrors: string[] = [];
  page.on("pageerror", (e) => browserErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") browserErrors.push(`console: ${msg.text()}`);
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);

  await page.getByLabel("Email").fill(MEMBER_EMAIL);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");

  const link = await latestMagicLink(request, MEMBER_EMAIL, startedAt);
  await page.goto(link);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(MEMBER_NAME);
  await expect(page.getByTestId("roles")).toContainText("member");
  await expect(page.getByTestId("season")).toContainText("Monsoon 2026");
  await expect(page.getByRole("contentinfo")).toContainText("education only");

  // H1: a member calling a core-only mutation gets 403 from the server.
  const forbidden = await page.request.post("/api/admin/roles", {
    data: {
      userId: "00000000-0000-0000-0000-000000000000",
      role: "member",
      seasonId: null,
    },
  });
  expect(forbidden.status()).toBe(403);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  expect(browserErrors).toEqual([]);
});

test("a non-Ashoka address is rejected before any email is sent", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("someone@gmail.com");
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "@ashoka.edu.in" }),
  ).toBeVisible();
});

test("signed-out visitor is not a guest of any member route", async ({
  request,
}) => {
  const response = await request.post("/api/admin/roles", {
    data: { userId: "00000000-0000-0000-0000-000000000000", role: "core" },
    maxRedirects: 0,
  });
  expect([401, 403]).toContain(response.status());
});
