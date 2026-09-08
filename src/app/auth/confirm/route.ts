import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { withGuest } from "@/db/client";
import { errorChainMessage } from "@/lib/errors";
import { requestLogger } from "@/lib/log";
import { confirmQuerySchema } from "@/lib/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Target of the magic-link email. Verifies the token, registers the user in
 * the portal on first sign-in (the database function enforces the email
 * domain), then redirects to `next`.
 */
export async function GET(request: NextRequest) {
  const log = await requestLogger({ route: "auth.confirm" });
  const url = request.nextUrl;
  const parsed = confirmQuerySchema.safeParse({
    token_hash: url.searchParams.get("token_hash"),
    type: url.searchParams.get("type"),
    next: url.searchParams.get("next") ?? undefined,
  });
  const loginWith = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, url.origin));

  if (!parsed.success) {
    log.warn("confirm called with invalid query");
    return loginWith("link");
  }
  const { token_hash, type, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error || !data.user) {
    log.warn("otp verification failed", { error });
    return loginWith("link");
  }
  const authUser = data.user;
  const email = authUser.email;
  if (!email) {
    await supabase.auth.signOut();
    return loginWith("link");
  }

  try {
    await withGuest((tx) =>
      tx.execute(
        sql`SELECT app_register_user(${authUser.id}::uuid, ${email}::text, ${""}::text)`,
      ),
    );
  } catch (cause) {
    // Domain not allowed, or a genuine failure. Either way the user must not
    // proceed with a session (H34: never pretend it worked).
    await supabase.auth.signOut();
    if (errorChainMessage(cause).includes("email domain not allowed")) {
      log.info("sign-in rejected: domain", { authIdentity: authUser.id });
      return loginWith("domain");
    }
    log.error("user registration failed", { error: cause });
    throw cause;
  }

  log.info("signed in", { authIdentity: authUser.id });
  return NextResponse.redirect(new URL(next, url.origin));
}
