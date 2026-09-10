/**
 * npm run db:seed — populate a development database from a clean state.
 *
 * Refuses to run when the database already has users: run `npm run db:reset`
 * for a fresh start. This is deliberate; an "idempotent" seed that quietly
 * merges into real data is how test rows end up in production.
 *
 * Contents: 3 verticals, 20 users across all roles and two cohorts, one
 * settled past season and one open season, a placeholder scenario with no
 * price bars (Phase 2 ingests them), forecast questions in every state,
 * research notes in every workflow state, events at and below capacity.
 */
import "./lib/load-env";
import { sql } from "drizzle-orm";
import { createSystemDb } from "@/db/system";
import * as s from "@/db/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadScenarioFile } from "@/lib/scenarios";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * DAY);
const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));

type RoleName = (typeof s.roleEnum.enumValues)[number];

interface SeedPerson {
  first: string;
  last: string;
  cohort: number;
  vertical: "Equities" | "Macro & Fixed Income" | "Quant";
  global?: Extract<RoleName, "core" | "faculty" | "alum" | "applicant">;
  lead?: boolean;
  /** In the open season (default true for members). */
  current?: boolean;
  /** Also a member of the settled past season. */
  past?: boolean;
}

// 20 people. Names are invented.
const PEOPLE: SeedPerson[] = [
  {
    first: "Aarav",
    last: "Mehta",
    cohort: 2026,
    vertical: "Equities",
    global: "core",
    past: true,
  },
  {
    first: "Diya",
    last: "Raghunathan",
    cohort: 2027,
    vertical: "Quant",
    lead: true,
  },
  {
    first: "Kabir",
    last: "Sethi",
    cohort: 2026,
    vertical: "Macro & Fixed Income",
    lead: true,
    past: true,
  },
  { first: "Meera", last: "Iyer", cohort: 2027, vertical: "Equities" },
  { first: "Rohan", last: "Chatterjee", cohort: 2027, vertical: "Equities" },
  {
    first: "Sara",
    last: "Qureshi",
    cohort: 2026,
    vertical: "Quant",
    past: true,
  },
  {
    first: "Vihaan",
    last: "Nair",
    cohort: 2027,
    vertical: "Macro & Fixed Income",
  },
  {
    first: "Ananya",
    last: "Bose",
    cohort: 2026,
    vertical: "Equities",
    past: true,
  },
  { first: "Ishaan", last: "Kapoor", cohort: 2027, vertical: "Quant" },
  {
    first: "Zara",
    last: "Fernandes",
    cohort: 2027,
    vertical: "Macro & Fixed Income",
  },
  { first: "Arjun", last: "Menon", cohort: 2026, vertical: "Equities" },
  { first: "Nisha", last: "Pillai", cohort: 2027, vertical: "Quant" },
  {
    first: "Dev",
    last: "Malhotra",
    cohort: 2026,
    vertical: "Macro & Fixed Income",
  },
  { first: "Tara", last: "Banerjee", cohort: 2027, vertical: "Equities" },
  { first: "Yash", last: "Agarwal", cohort: 2027, vertical: "Quant" },
  { first: "Priya", last: "Venkatesh", cohort: 2026, vertical: "Equities" },
  {
    first: "Neel",
    last: "Joshi",
    cohort: 2026,
    vertical: "Macro & Fixed Income",
    past: true,
  },
  {
    first: "Rhea",
    last: "Dsouza",
    cohort: 2025,
    vertical: "Equities",
    global: "alum",
    current: false,
    past: true,
  },
  {
    first: "Manav",
    last: "Bhatia",
    cohort: 2028,
    vertical: "Quant",
    global: "applicant",
    current: false,
  },
  {
    first: "Lakshmi",
    last: "Krishnan",
    cohort: 2026,
    vertical: "Equities",
    global: "faculty",
    current: false,
  },
];

function emailFor(p: SeedPerson): string {
  const suffix =
    p.global === "faculty" ? "" : `_ug${String(p.cohort).slice(2)}`;
  return `${p.first}.${p.last}${suffix}@ashoka.edu.in`.toLowerCase();
}

async function main() {
  const { db, close } = createSystemDb();
  const admin = createSupabaseAdminClient();
  try {
    const counted = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM users`,
    );
    const count = counted[0]?.count ?? 0;
    if (count > 0) {
      throw new Error(
        `Refusing to seed: the database already has ${count} user(s). Run \`npm run db:reset\` for a clean start.`,
      );
    }

    // --- auth users (Supabase Auth admin API) --------------------------------
    const authIds = new Map<string, string>();
    for (const p of PEOPLE) {
      const email = emailFor(p);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { seeded: true },
      });
      if (error || !data.user)
        throw new Error(`auth user ${email}: ${error?.message}`);
      authIds.set(email, data.user.id);
    }

    await db.transaction(async (tx) => {
      // --- verticals ---------------------------------------------------------
      const verticalRows = await tx
        .insert(s.verticals)
        .values([
          { name: "Equities" },
          { name: "Macro & Fixed Income" },
          { name: "Quant" },
        ])
        .returning();
      const verticalId = (name: string) => {
        const v = verticalRows.find((r) => r.name === name);
        if (!v) throw new Error(`vertical ${name}`);
        return v.id;
      };

      // --- seasons -----------------------------------------------------------
      const [past] = await tx
        .insert(s.seasons)
        .values({
          name: "Spring 2026",
          startsAt: utc(2026, 1, 12),
          endsAt: utc(2026, 5, 8),
        })
        .returning();
      const [open] = await tx
        .insert(s.seasons)
        .values({
          name: "Monsoon 2026",
          startsAt: utc(2026, 8, 24),
          endsAt: utc(2026, 12, 4),
        })
        .returning();
      if (!past || !open) throw new Error("seasons");

      // --- users, roles, memberships ----------------------------------------
      const userRows = await tx
        .insert(s.users)
        .values(
          PEOPLE.map((p) => ({
            authIdentity: authIds.get(emailFor(p)) ?? "",
            email: emailFor(p),
            displayName: `${p.first} ${p.last}`,
            cohortYear: p.cohort,
          })),
        )
        .returning();
      const userId = (p: SeedPerson) => {
        const u = userRows.find((r) => r.email === emailFor(p));
        if (!u) throw new Error(`user ${emailFor(p)}`);
        return u.id;
      };
      const core = PEOPLE[0]!;
      const coreId = userId(core);

      const roleValues: (typeof s.userRoles.$inferInsert)[] = [];
      const membershipValues: (typeof s.memberships.$inferInsert)[] = [];
      for (const p of PEOPLE) {
        const uid = userId(p);
        if (p.global)
          roleValues.push({
            userId: uid,
            role: p.global,
            seasonId: null,
            grantedBy: coreId,
          });
        const current = p.current ?? true;
        if (current) {
          roleValues.push({
            userId: uid,
            role: "member",
            seasonId: open.id,
            grantedBy: coreId,
          });
          if (p.lead)
            roleValues.push({
              userId: uid,
              role: "lead",
              seasonId: open.id,
              grantedBy: coreId,
            });
          membershipValues.push({
            userId: uid,
            seasonId: open.id,
            verticalId: verticalId(p.vertical),
          });
        }
        if (p.past) {
          roleValues.push({
            userId: uid,
            role: "member",
            seasonId: past.id,
            grantedBy: coreId,
          });
          membershipValues.push({
            userId: uid,
            seasonId: past.id,
            verticalId: verticalId(p.vertical),
            status: "inactive",
          });
        }
      }
      await tx.insert(s.userRoles).values(roleValues);
      await tx.insert(s.memberships).values(membershipValues);

      const applicant = PEOPLE.find((p) => p.global === "applicant")!;
      await tx.insert(s.applications).values({
        userId: userId(applicant),
        statement:
          "I run a small paper portfolio and want to learn to write a thesis properly.",
      });

      // --- instruments -------------------------------------------------------
      // Symbols match the v1 snapshot so that `npm run db:load-snapshot -- v1`
      // updates these rows rather than colliding with them. Price bars come
      // only from a snapshot; the seed never writes one.
      const instrumentRows = await tx
        .insert(s.instruments)
        .values([
          {
            symbol: "RELIANCE",
            name: "Reliance Industries",
            assetClass: "equity",
          },
          {
            symbol: "TCS",
            name: "Tata Consultancy Services",
            assetClass: "equity",
          },
          { symbol: "INFY", name: "Infosys", assetClass: "equity" },
          {
            symbol: "NIFTYBEES",
            name: "Nippon India ETF Nifty 50 BeES",
            assetClass: "etf",
          },
          {
            symbol: "GOLDBEES",
            name: "Nippon India ETF Gold BeES",
            assetClass: "commodity",
          },
          {
            symbol: "FD1Y",
            name: "Fixed deposit, 1-3 year rolling reinvestment index",
            assetClass: "fixed_deposit",
          },
          {
            symbol: "CASH",
            name: "Indian rupee, uninvested",
            assetClass: "cash",
          },
        ])
        .returning();
      const instrumentId = (symbol: string) => {
        const i = instrumentRows.find((r) => r.symbol === symbol);
        if (!i) throw new Error(`instrument ${symbol}`);
        return i.id;
      };

      // --- the v1 scenario, and an open game -----------------------------------
      // The config is the committed one in data/scenarios, parsed and stored
      // whole, so the row and the file cannot drift. `(name, version)` is
      // unique and a config is never edited in place (H6): changing anything
      // means writing v2 and seeding that instead.
      const scenarioFile = loadScenarioFile("first-replay", 1);
      const [scenario] = await tx
        .insert(s.scenarios)
        .values({
          name: scenarioFile.name,
          version: scenarioFile.version,
          seed: scenarioFile.seed,
          configJson: scenarioFile.raw,
          universe: scenarioFile.raw.universe,
          startDate: scenarioFile.window.start,
          endDate: scenarioFile.window.end,
        })
        .returning();
      if (!scenario) throw new Error("scenario");
      await tx.insert(s.gameInstances).values({
        scenarioId: scenario.id,
        seasonId: open.id,
        opensAt: daysFromNow(-1),
        closesAt: daysFromNow(60),
        state: "open",
      });

      // --- forecast questions: open, closed-unresolved, resolved --------------
      const members = PEOPLE.filter(
        (p) => (p.current ?? true) && !p.global,
      ).slice(0, 6);
      const [qOpen, qClosed, qResolved] = await tx
        .insert(s.forecastQuestions)
        .values([
          {
            seasonId: open.id,
            prompt:
              "Will the RBI repo rate be below 6.00% at the close of its December policy meeting?",
            resolutionCriteria:
              "Per the RBI press release on the day of the December MPC decision.",
            closesAt: daysFromNow(30),
          },
          {
            seasonId: open.id,
            prompt: "Will NIFTY 50 close above 26,000 on 30 September 2026?",
            resolutionCriteria:
              "Official NSE closing value on 30 September 2026.",
            closesAt: daysFromNow(30), // moved into the past after forecasts are inserted
          },
          {
            seasonId: open.id,
            prompt:
              "Will India's August 2026 CPI print above 4.0% year on year?",
            resolutionCriteria: "MoSPI press release for August 2026 CPI.",
            closesAt: daysFromNow(30), // moved into the past and resolved below
          },
        ])
        .returning();
      if (!qOpen || !qClosed || !qResolved) throw new Error("questions");

      const probs = [
        "0.3500",
        "0.6200",
        "0.4800",
        "0.7100",
        "0.2500",
        "0.5500",
      ];
      for (const q of [qOpen, qClosed, qResolved]) {
        await tx.insert(s.forecasts).values(
          members.map((p, i) => ({
            questionId: q.id,
            userId: userId(p),
            probability: probs[i % probs.length]!,
            rationale: `Base rate plus recent prints; see notes. (${p.first})`,
          })),
        );
      }
      // Now close two of them, in the past, and resolve one. The forecasts
      // above were accepted because they were inserted before closes_at.
      await tx
        .update(s.forecastQuestions)
        .set({ closesAt: daysFromNow(-2) })
        .where(sql`${s.forecastQuestions.id} = ${qClosed.id}`);
      await tx
        .update(s.forecastQuestions)
        .set({
          closesAt: daysFromNow(-10),
          resolvedAt: daysFromNow(-3),
          outcome: true,
        })
        .where(sql`${s.forecastQuestions.id} = ${qResolved.id}`);

      // --- research notes in every workflow state ---------------------------
      const author = (i: number) => userId(members[i % members.length]!);
      const noteStates = s.noteStateEnum.enumValues;
      await tx.insert(s.researchNotes).values(
        noteStates.map((state, i) => ({
          authorId: author(i),
          seasonId: open.id,
          instrumentId: instrumentId(
            ["RELIANCE", "TCS", "GOLDBEES", "INFY", "NIFTYBEES", "RELIANCE"][
              i
            ]!,
          ),
          title: `Sample note ${i + 1} (${state})`,
          slug: `sample-note-${i + 1}-${state.replace(/_/g, "-")}`,
          bodyMd: `# Sample note ${i + 1}\n\nThis is seed content in state \`${state}\`. It is not analysis.`,
          state,
          publishedAt: state === "published" ? daysFromNow(-1) : null,
        })),
      );

      // --- curriculum ------------------------------------------------------
      const [track] = await tx
        .insert(s.tracks)
        .values({
          name: "Foundations",
          orderIndex: 1,
          description: "How markets and the club work.",
        })
        .returning();
      if (!track) throw new Error("track");
      await tx.insert(s.modules).values([
        {
          trackId: track.id,
          orderIndex: 1,
          title: "Reading a price chart honestly",
          bodyMd: "Seed content.",
          state: "published",
        },
        {
          trackId: track.id,
          orderIndex: 2,
          title: "Writing a falsifiable thesis",
          bodyMd: "Seed content.",
          state: "pending_review",
        },
        {
          trackId: track.id,
          orderIndex: 3,
          title: "Calibration and forecasting",
          bodyMd: "Seed content.",
          state: "draft",
        },
      ]);

      // --- events: one at capacity (with a waitlist), one below --------------
      const [evFull, evOpen] = await tx
        .insert(s.events)
        .values([
          {
            seasonId: open.id,
            title: "Thesis workshop",
            startsAt: daysFromNow(5),
            capacity: 3,
            location: "AC-04 302",
          },
          {
            seasonId: open.id,
            title: "Guest talk: fixed income desk",
            startsAt: daysFromNow(12),
            capacity: 40,
            location: "Auditorium",
          },
        ])
        .returning();
      if (!evFull || !evOpen) throw new Error("events");
      await tx.insert(s.rsvps).values([
        ...members.slice(0, 3).map((p) => ({
          eventId: evFull.id,
          userId: userId(p),
          state: "going" as const,
        })),
        {
          eventId: evFull.id,
          userId: userId(members[3]!),
          state: "waitlisted" as const,
        },
        ...members.slice(0, 2).map((p) => ({
          eventId: evOpen.id,
          userId: userId(p),
          state: "going" as const,
        })),
      ]);

      // --- settled past season: a few rows, then settle it -------------------
      const pastMembers = PEOPLE.filter((p) => p.past);
      const [qPast] = await tx
        .insert(s.forecastQuestions)
        .values({
          seasonId: past.id,
          prompt: "Will the April 2026 MPC hold the repo rate?",
          resolutionCriteria: "RBI press release, April 2026 MPC.",
          closesAt: daysFromNow(30),
        })
        .returning();
      if (!qPast) throw new Error("past question");
      await tx.insert(s.forecasts).values(
        pastMembers.map((p, i) => ({
          questionId: qPast.id,
          userId: userId(p),
          probability: probs[i % probs.length]!,
          rationale: "Seed rationale.",
        })),
      );
      await tx
        .update(s.forecastQuestions)
        .set({
          closesAt: utc(2026, 4, 1),
          resolvedAt: utc(2026, 4, 9),
          outcome: true,
        })
        .where(sql`${s.forecastQuestions.id} = ${qPast.id}`);
      await tx.insert(s.researchNotes).values({
        authorId: userId(pastMembers[0]!),
        seasonId: past.id,
        instrumentId: instrumentId("TCS"),
        title: "Spring 2026 archive note",
        slug: "spring-2026-archive-note",
        bodyMd: "Archived seed content.",
        state: "published",
        publishedAt: utc(2026, 3, 15),
      });
      await tx.insert(s.scores).values(
        pastMembers.map((p, i) => ({
          userId: userId(p),
          seasonId: past.id,
          track: "calibration",
          value: (0.61 + i * 0.03).toFixed(4),
          componentsJson: { brier: (0.21 - i * 0.01).toFixed(4), n: 1 },
        })),
      );
      for (const state of ["open", "closed", "settled"] as const) {
        await tx
          .update(s.seasons)
          .set({ state })
          .where(sql`${s.seasons.id} = ${past.id}`);
      }
      await tx
        .update(s.seasons)
        .set({ state: "open" })
        .where(sql`${s.seasons.id} = ${open.id}`);

      await tx.insert(s.auditLog).values({
        actorId: null,
        action: "seed.completed",
        entityType: "database",
        entityId: "seed",
        afterJson: { users: PEOPLE.length, seasons: 2 },
      });
    });

    console.log(
      `Seeded ${PEOPLE.length} users, 2 seasons, 6 instruments, 4 forecast questions, ${s.noteStateEnum.enumValues.length + 1} research notes, 2 events.`,
    );
    console.log(
      `Core user: ${emailFor(PEOPLE[0]!)} — sign in with a magic link from Mailpit (http://127.0.0.1:54324).`,
    );
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
