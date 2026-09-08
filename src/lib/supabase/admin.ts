import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Supabase Auth ADMIN client (secret key). Creates auth users for the seed
 * script and the login end-to-end test. Server-only; never import from
 * src/app.
 */
export function createSupabaseAdminClient() {
  const e = env();
  return createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
