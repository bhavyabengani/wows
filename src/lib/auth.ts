import { eq, sql } from "drizzle-orm";
import { cache } from "react";
import { withGuest, withUser } from "@/db/client";
import { userRoles, type roleEnum } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Role = (typeof roleEnum.enumValues)[number];

export interface RoleGrant {
  role: Role;
  seasonId: string | null;
}

export interface CurrentUser {
  id: string;
  authIdentity: string;
  email: string;
  displayName: string;
  cohortYear: number | null;
  roles: RoleGrant[];
}

/** Thrown when a signed-in user lacks the role for an action (H1). Maps to 403. */
export class ForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown when there is no signed-in user. Maps to 401. */
export class UnauthenticatedError extends Error {
  readonly status = 401 as const;
  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

type LookupRow = {
  id: string;
  email: string;
  display_name: string;
  cohort_year: number | null;
};

/**
 * Resolves the signed-in user (Supabase Auth) to the portal user and roles.
 * Cached per request. Returns null when signed out or not yet registered.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const rows = await withGuest(async (tx) => {
    const result = await tx.execute<LookupRow>(
      sql`SELECT id, email, display_name, cohort_year FROM app_lookup_user(${authUser.id}::uuid)`,
    );
    return [...result];
  });
  const row = rows[0];
  if (!row) return null;

  const grants = await withUser(row.id, (tx) =>
    tx
      .select({ role: userRoles.role, seasonId: userRoles.seasonId })
      .from(userRoles)
      .where(eq(userRoles.userId, row.id)),
  );

  return {
    id: row.id,
    authIdentity: authUser.id,
    email: row.email,
    displayName: row.display_name,
    cohortYear: row.cohort_year,
    roles: grants,
  };
});

export function hasRole(
  user: Pick<CurrentUser, "roles">,
  role: Role,
  seasonId?: string,
): boolean {
  return user.roles.some(
    (g) =>
      g.role === role &&
      (seasonId === undefined ||
        g.seasonId === null ||
        g.seasonId === seasonId),
  );
}

/**
 * The single role gate for every mutating server action and route handler
 * (H1). Passes when the user holds ANY of `roles` (for `seasonId` when given).
 * Throws `UnauthenticatedError` or `ForbiddenError`; never returns a boolean
 * that a caller could forget to check.
 */
export async function requireRole(
  roles: readonly Role[],
  options: { seasonId?: string } = {},
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  if (!roles.some((r) => hasRole(user, r, options.seasonId))) {
    throw new ForbiddenError();
  }
  return user;
}

/** Converts auth errors into HTTP responses for route handlers. */
export function authErrorResponse(error: unknown): Response | null {
  if (
    error instanceof ForbiddenError ||
    error instanceof UnauthenticatedError
  ) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
