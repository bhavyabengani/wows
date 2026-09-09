import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Signing in, as a helper.
 *
 * Extracted from the Phase 1 login test so the allocation-game tests can reach
 * a signed-in page without repeating the Mailpit dance. The flow itself is
 * still covered by `login.spec.ts`; this is only the means to an end.
 */

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

interface MailpitMessage {
  ID: string;
  Created: string;
  To: { Address: string }[];
}

export async function latestMagicLink(
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
      const message = await request.get(
        `${MAILPIT}/api/v1/message/${fresh.ID}`,
      );
      const { HTML } = (await message.json()) as { HTML: string };
      const match = HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
      if (match?.[1]) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`no magic link for ${email} arrived in Mailpit`);
}

export async function signIn(
  page: Page,
  request: APIRequestContext,
  email: string,
): Promise<void> {
  const startedAt = Date.now();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  const link = await latestMagicLink(request, email, startedAt);
  await page.goto(link);
  await expect(page).toHaveURL(/\/dashboard$/);
}
