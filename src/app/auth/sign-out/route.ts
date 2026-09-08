import { NextResponse } from "next/server";
import { requestLogger } from "@/lib/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  const log = await requestLogger({ route: "auth.sign_out" });
  if (error) log.warn("sign out reported an error", { error });
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
