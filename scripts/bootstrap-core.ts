/**
 * npm run db:bootstrap-core -- <email>
 *
 * One-off PRODUCTION bootstrap: grants the global `core` role to an existing
 * portal user by email. Without this, nobody in a fresh deployment can
 * promote anyone (new sign-ups land as `applicant`).
 *
 * Steps: the person signs in once via magic link (which creates their users
 * row), then an operator runs this against the production DATABASE_URL.
 * Writes an audit_log entry with actor NULL (system action).
 */
import "./lib/load-env";
import { eq } from "drizzle-orm";
import { createSystemDb } from "@/db/system";
import { auditLog, userRoles, users } from "@/db/schema";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("usage: npm run db:bootstrap-core -- <email>");
    process.exit(2);
  }
  const { db, close } = createSystemDb();
  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      throw new Error(
        `No portal user with email ${email}. They must sign in once first.`,
      );
    }
    const inserted = await db
      .insert(userRoles)
      .values({
        userId: user.id,
        role: "core",
        seasonId: null,
        grantedBy: null,
      })
      .onConflictDoNothing()
      .returning({ id: userRoles.id });
    if (inserted.length === 0) {
      console.log(`${email} already holds core. Nothing changed.`);
      return;
    }
    await db.insert(auditLog).values({
      actorId: null,
      action: "role.granted",
      entityType: "user_roles",
      entityId: inserted[0]!.id,
      afterJson: {
        userId: user.id,
        role: "core",
        seasonId: null,
        via: "bootstrap-core",
      },
      reason: "production bootstrap: first core user",
    });
    console.log(`Granted core to ${email} (${user.id}).`);
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
