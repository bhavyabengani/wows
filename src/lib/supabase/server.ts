import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Supabase Auth client for server components, server actions and route
 * handlers. Used for session handling only; data access goes through
 * Drizzle with RLS (src/db/client.ts), never through PostgREST.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const pub = publicEnv();
  return createServerClient(
    pub.NEXT_PUBLIC_SUPABASE_URL,
    pub.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a server component: cookies are read-only there and
            // src/proxy.ts has already refreshed the session.
          }
        },
      },
    },
  );
}
