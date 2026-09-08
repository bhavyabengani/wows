import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { withUser } from "@/db/client";
import { seasons } from "@/db/schema";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { formatInIST } from "@/lib/time";

export const metadata = { title: "Dashboard — WOWS Portal" };
export const dynamic = "force-dynamic";

/**
 * Phase 1 stub: display name, current season, roles. Loading state is
 * loading.tsx, error state is error.tsx (a thrown error surfaces there, H34),
 * empty state is the "no open season" block below.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const openSeason = await withUser(user.id, async (tx) => {
    const rows = await tx
      .select({
        id: seasons.id,
        name: seasons.name,
        startsAt: seasons.startsAt,
        endsAt: seasons.endsAt,
      })
      .from(seasons)
      .where(eq(seasons.state, "open"))
      .limit(1);
    return rows[0] ?? null;
  });

  const isApplicant =
    hasRole(user, "applicant") &&
    user.roles.every((r) => r.role === "applicant");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-wows-ink">
        {user.displayName}
      </h1>
      <p className="mt-1 text-sm text-wows-muted">{user.email}</p>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-md border border-wows-rule bg-wows-surface p-5">
          <h2 className="text-sm font-medium text-wows-muted">Roles</h2>
          <ul
            className="mt-2 space-y-1 text-sm text-wows-ink"
            data-testid="roles"
          >
            {user.roles.map((g) => (
              <li key={`${g.role}:${g.seasonId ?? "global"}`}>
                {g.role}
                {g.seasonId ? "" : " (global)"}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-wows-rule bg-wows-surface p-5">
          <h2 className="text-sm font-medium text-wows-muted">
            Current season
          </h2>
          {isApplicant ? (
            <p
              className="mt-2 text-sm text-wows-ink"
              data-testid="season-empty"
            >
              Your application is with the core team. You will see the season
              here once you are admitted.
            </p>
          ) : openSeason ? (
            <div className="mt-2 text-sm text-wows-ink" data-testid="season">
              <p className="font-medium">{openSeason.name}</p>
              <p className="numeric mt-1 text-wows-muted">
                {formatInIST(openSeason.startsAt, { withTime: false })} to{" "}
                {formatInIST(openSeason.endsAt, { withTime: false })}
              </p>
            </div>
          ) : (
            <p
              className="mt-2 text-sm text-wows-ink"
              data-testid="season-empty"
            >
              No season is open right now. The core team opens one at the start
              of each semester.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
