import { withUser } from "@/db/client";
import { auditLog, userRoles } from "@/db/schema";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { requestLogger } from "@/lib/log";
import { grantRoleSchema } from "@/lib/schemas/auth";

/**
 * POST /api/admin/roles — grant a role (core only, H1). Audit-logged (H31).
 * This is how core promotes an applicant to member.
 */
export async function POST(request: Request) {
  const log = await requestLogger({ route: "admin.roles.grant" });
  try {
    const actor = await requireRole(["core"]);
    const parsed = grantRoleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const grant = parsed.data;

    const inserted = await withUser(actor.id, async (tx) => {
      const rows = await tx
        .insert(userRoles)
        .values({
          userId: grant.userId,
          role: grant.role,
          seasonId: grant.seasonId,
          grantedBy: actor.id,
        })
        .onConflictDoNothing()
        .returning({ id: userRoles.id });
      const row = rows[0];
      if (row) {
        await tx.insert(auditLog).values({
          actorId: actor.id,
          action: "role.granted",
          entityType: "user_roles",
          entityId: row.id,
          afterJson: grant,
        });
      }
      return row ?? null;
    });

    log.info("role grant handled", {
      granted: inserted !== null,
      role: grant.role,
    });
    return Response.json(
      { granted: inserted !== null, id: inserted?.id ?? null },
      { status: inserted ? 201 : 200 },
    );
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    log.error("role grant failed", { error });
    return Response.json({ error: "Role grant failed" }, { status: 500 });
  }
}
