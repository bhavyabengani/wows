import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";

/**
 * Guarded layout for member routes. src/proxy.ts already redirects
 * signed-out visitors; this is the server-side check that actually counts.
 */
export default async function MemberLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-wows-rule bg-wows-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <span className="text-sm font-medium text-wows-ink">WOWS Portal</span>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="text-sm text-wows-accent-soft underline underline-offset-4"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
