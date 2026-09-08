"use server";

import { EnvError, publicEnv } from "@/lib/env";
import { requestLogger } from "@/lib/log";
import { magicLinkRequestSchema } from "@/lib/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export async function requestMagicLink(
  _previous: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = magicLinkRequestSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid email.",
    };
  }
  const { email } = parsed.data;
  const log = await requestLogger({ action: "auth.magic_link" });

  let error: { message: string } | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    ({ error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      },
    }));
  } catch (cause) {
    if (cause instanceof EnvError) {
      log.error("sign-in is not configured on this deployment", {
        error: cause,
      });
      return {
        status: "error",
        message:
          "Sign-in is not set up on this deployment yet. Ask the core team.",
      };
    }
    throw cause;
  }
  if (error) {
    log.error("magic link request failed", {
      error,
      emailDomain: email.split("@")[1],
    });
    return {
      status: "error",
      message:
        "We could not send a sign-in link right now. Try again in a minute.",
    };
  }
  log.info("magic link sent", { emailDomain: email.split("@")[1] });
  return { status: "sent", email };
}
