/**
 * WOWS Portal — database schema (Drizzle).
 *
 * This file is the source of truth for tables, columns, keys and indexes.
 * Database roles, triggers (append-only, immutability windows, season state
 * machine, settled-season guard) and row-level-security policies live in
 * hand-written SQL migrations under drizzle/migrations, because Drizzle's
 * schema language cannot express them. Read both before changing either.
 *
 * Conventions (CLAUDE.md):
 *   - every timestamp is `timestamptz`, stored UTC (H33)
 *   - every currency column is `bigint` integer paise, suffixed `_paise` (H12)
 *   - fractional quantities are `numeric(18,4)`; see docs/ENGINE_RULES.md
 *   - RLS is enabled on every table; policies are in SQL
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** `guest` is the absence of a session and is never stored. */
export const roleEnum = pgEnum("role", [
  "applicant",
  "member",
  "lead",
  "core",
  "faculty",
  "alum",
]);

export const seasonStateEnum = pgEnum("season_state", [
  "draft",
  "open",
  "closed",
  "settled",
  "archived",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "inactive",
]);

export const applicationStateEnum = pgEnum("application_state", [
  "submitted",
  "accepted",
  "rejected",
]);

/**
 * The seven asset classes the game plays with. `fixed_deposit` is separate
 * from `cash` because a deposit earns a published rate and carries a lock-in,
 * while cash earns nothing; storing it as cash would also contradict the rule
 * that cash has no price bars.
 */
export const assetClassEnum = pgEnum("asset_class", [
  "equity",
  "etf",
  "index",
  "bond",
  "commodity",
  "fixed_deposit",
  "cash",
]);

export const gameStateEnum = pgEnum("game_state", ["draft", "open", "closed"]);

export const runStateEnum = pgEnum("run_state", [
  "in_progress",
  "completed",
  "abandoned",
]);

export const orderSideEnum = pgEnum("order_side", ["buy", "sell"]);

export const noteStateEnum = pgEnum("note_state", [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "published",
  "rejected",
]);

export const moduleStateEnum = pgEnum("module_state", [
  "draft",
  "pending_review",
  "published",
]);

/**
 * A ranked run counts for the leaderboard; a practice run never does. One
 * ranked attempt per scenario version is the rule (Phase 4 enforces it), and
 * `runs.state` cannot express this because it tracks a run's lifecycle, not
 * whether it counts.
 */
export const runModeEnum = pgEnum("run_mode", ["ranked", "practice"]);

export const rsvpStateEnum = pgEnum("rsvp_state", [
  "going",
  "waitlisted",
  "cancelled",
]);

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

const id = () => uuid("id").primaryKey().defaultRandom();
const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => timestamptz("created_at").notNull().defaultNow();
/** Integer paise. `mode: "bigint"` keeps currency out of JS `number` (H12). */
const paise = (name: string) => bigint(name, { mode: "bigint" });
/** Fractional quantity; scale and rounding rule in docs/ENGINE_RULES.md. */
const quantity = (name: string) => numeric(name, { precision: 18, scale: 4 });

// ---------------------------------------------------------------------------
// People, seasons, roles
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: id(),
    /** `auth.users.id` from Supabase Auth. */
    authIdentity: uuid("auth_identity").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    cohortYear: integer("cohort_year"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_auth_identity_key").on(t.authIdentity),
    uniqueIndex("users_email_key").on(t.email),
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
  ],
).enableRLS();

export const seasons = pgTable(
  "seasons",
  {
    id: id(),
    name: text("name").notNull(),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    /** Transitions enforced by trigger: draft → open → closed → settled → archived. */
    state: seasonStateEnum("state").notNull().default("draft"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("seasons_name_key").on(t.name),
    check("seasons_dates_ordered", sql`${t.endsAt} > ${t.startsAt}`),
  ],
).enableRLS();

export const verticals = pgTable(
  "verticals",
  {
    id: id(),
    name: text("name").notNull(),
    createdAt: createdAt(),
    // No `lead_user_id`: who leads a vertical is derived from the season's
    // `lead` role plus that user's membership vertical (one source of truth).
  },
  (t) => [uniqueIndex("verticals_name_key").on(t.name)],
).enableRLS();

/**
 * Roles are additive: a user holds any number of rows here.
 * Global roles (`applicant`, `core`, `faculty`, `alum`) have `season_id` NULL.
 * Season roles (`member`, `lead`) have `season_id` set.
 * `core` is deliberately global: core must be able to create the first
 * season, so there is nothing for a per-season core role to attach to.
 */
export const userRoles = pgTable(
  "user_roles",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    seasonId: uuid("season_id").references(() => seasons.id, {
      onDelete: "cascade",
    }),
    grantedBy: uuid("granted_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique("user_roles_user_role_season_key")
      .on(t.userId, t.role, t.seasonId)
      .nullsNotDistinct(),
    index("user_roles_user_idx").on(t.userId),
    check(
      "user_roles_scope",
      sql`(${t.role} IN ('member','lead') AND ${t.seasonId} IS NOT NULL)
          OR (${t.role} IN ('applicant','core','faculty','alum') AND ${t.seasonId} IS NULL)`,
    ),
  ],
).enableRLS();

/** Season participation: which vertical, and whether currently active. */
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    verticalId: uuid("vertical_id").references(() => verticals.id, {
      onDelete: "set null",
    }),
    status: membershipStatusEnum("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("memberships_user_season_key").on(t.userId, t.seasonId),
    index("memberships_season_idx").on(t.seasonId),
  ],
).enableRLS();

/** An applicant's request to join. One per user; decided by core. */
export const applications = pgTable(
  "applications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    statement: text("statement").notNull(),
    state: applicationStateEnum("state").notNull().default("submitted"),
    submittedAt: timestamptz("submitted_at").notNull().defaultNow(),
    decidedAt: timestamptz("decided_at"),
    decidedBy: uuid("decided_by").references(() => users.id),
  },
  (t) => [uniqueIndex("applications_user_key").on(t.userId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Market data and scenarios
// ---------------------------------------------------------------------------

export const instruments = pgTable(
  "instruments",
  {
    id: id(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    assetClass: assetClassEnum("asset_class").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("instruments_symbol_key").on(t.symbol)],
).enableRLS();

/**
 * One row per loaded market-data snapshot: how to read the prices in it.
 *
 * Prices are adjusted for splits and bonuses up to the day they were fetched,
 * including events *after* the replay window, so a stored level is not the
 * level that traded. Screens must say so rather than printing a bare rupee
 * figure, which is what `isAdjusted` and `adjustedAsOf` are for. The engine
 * carries these through without acting on them.
 *
 * `priceBasis` is `price_return`: dividends are not in the series at all, for
 * any instrument, so comparisons between them are consistent but understate
 * real equity returns. See docs/DATA.md.
 */
export const snapshots = pgTable(
  "snapshots",
  {
    version: integer("version").primaryKey(),
    builtAt: timestamptz("built_at").notNull(),
    fetchDate: date("fetch_date", { mode: "string" }).notNull(),
    isAdjusted: boolean("is_adjusted").notNull(),
    adjustedAsOf: date("adjusted_as_of", { mode: "string" }).notNull(),
    priceBasis: text("price_basis").notNull(),
    dividendsIncluded: boolean("dividends_included").notNull(),
    /** False until the RBI deposit series is replaced from the published source. */
    fdSeriesVerified: boolean("fd_series_verified").notNull(),
    barsSha256: text("bars_sha256").notNull(),
    loadedAt: createdAt(),
  },
  (t) => [check("snapshots_version_positive", sql`${t.version} >= 1`)],
).enableRLS();

/** Append-only (H7). Corrections are a new `snapshot_version`, never an update. */
export const priceBars = pgTable(
  "price_bars",
  {
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    tradeDate: date("trade_date", { mode: "string" }).notNull(),
    snapshotVersion: integer("snapshot_version").notNull(),
    openPaise: paise("open_paise").notNull(),
    highPaise: paise("high_paise").notNull(),
    lowPaise: paise("low_paise").notNull(),
    closePaise: paise("close_paise").notNull(),
    volume: bigint("volume", { mode: "bigint" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({
      name: "price_bars_pkey",
      columns: [t.instrumentId, t.tradeDate, t.snapshotVersion],
    }),
    check(
      "price_bars_positive_prices",
      sql`${t.openPaise} > 0 AND ${t.highPaise} > 0 AND ${t.lowPaise} > 0 AND ${t.closePaise} > 0`,
    ),
    check("price_bars_low_high", sql`${t.lowPaise} <= ${t.highPaise}`),
    check("price_bars_volume_nonneg", sql`${t.volume} >= 0`),
    check("price_bars_snapshot_positive", sql`${t.snapshotVersion} >= 1`),
  ],
).enableRLS();

/** `(name, version)` unique; rows are never edited in place (H6, trigger). */
export const scenarios = pgTable(
  "scenarios",
  {
    id: id(),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    configJson: jsonb("config_json").notNull(),
    /** Seed for the deterministic engine (H14). Text to avoid JS precision limits. */
    seed: text("seed").notNull(),
    /** Instrument symbols in play. JSON array of strings (sketch column kept as-is). */
    universe: jsonb("universe").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("scenarios_name_version_key").on(t.name, t.version),
    check("scenarios_version_positive", sql`${t.version} >= 1`),
    check("scenarios_dates_ordered", sql`${t.endDate} >= ${t.startDate}`),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Allocation game
// ---------------------------------------------------------------------------

export const gameInstances = pgTable(
  "game_instances",
  {
    id: id(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "restrict" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    opensAt: timestamptz("opens_at").notNull(),
    closesAt: timestamptz("closes_at").notNull(),
    state: gameStateEnum("state").notNull().default("draft"),
    createdAt: createdAt(),
  },
  (t) => [
    index("game_instances_season_idx").on(t.seasonId),
    check("game_instances_window", sql`${t.closesAt} > ${t.opensAt}`),
  ],
).enableRLS();

export const runs = pgTable(
  "runs",
  {
    id: id(),
    gameInstanceId: uuid("game_instance_id")
      .notNull()
      .references(() => gameInstances.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    currentStep: integer("current_step").notNull().default(0),
    state: runStateEnum("state").notNull().default("in_progress"),
    mode: runModeEnum("mode").notNull().default("practice"),
    /**
     * The engine's own state, minus its ledger: generator state, the drawn
     * shock, the opening and current target weights, the step schedule and the
     * sequence counters. The ledger itself lives in `run_ledger_entries`,
     * which is append-only; this row is the small mutable remainder, and it is
     * what makes a closed laptop lose nothing (H18).
     *
     * Never sent to the browser. It holds the seed's drawn shock and the whole
     * step schedule, which the player must not see (H15).
     */
    engineState: jsonb("engine_state"),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    completedAt: timestamptz("completed_at"),
  },
  (t) => [
    index("runs_user_idx").on(t.userId),
    index("runs_game_instance_idx").on(t.gameInstanceId),
    check("runs_step_nonneg", sql`${t.currentStep} >= 0`),
  ],
).enableRLS();

/**
 * A fixed-window rate limiter, in the database rather than in memory.
 *
 * The app runs on serverless instances that do not share memory, so a counter
 * held in a module variable would reset whenever a new instance started and
 * would not be a limit at all. This is a small table and one upsert per
 * request, which is the honest cost of a limit that works.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    /** Who and what: `${userId}:${route}`. */
    bucket: text("bucket").notNull(),
    /** Start of the fixed window this count belongs to. */
    windowStart: timestamptz("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({
      name: "rate_limits_pkey",
      columns: [t.bucket, t.windowStart],
    }),
    check("rate_limits_count_nonneg", sql`${t.count} >= 0`),
  ],
).enableRLS();

/**
 * The run's ledger (H13): every state-changing occurrence, in order, never
 * updated and never deleted.
 *
 * `orders` and `fills` carry the trades in typed columns, because the Phase 1
 * schema defines them that way and later phases query them. This table carries
 * the *whole* ledger, trades included, because cash flows have no typed table
 * and a ledger missing its income and expenses is not a ledger. Folding this
 * table reproduces the engine's own state exactly;
 * `src/db/run-ledger.db.test.ts` asserts the two agree.
 */
export const runLedgerEntries = pgTable(
  "run_ledger_entries",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "restrict" }),
    /** Monotonic within a run; the engine assigns it. */
    seq: integer("seq").notNull(),
    stepIndex: integer("step_index").notNull(),
    tradeDate: date("trade_date", { mode: "string" }).notNull(),
    kind: text("kind").notNull(),
    /** The engine's entry, verbatim, with bigints as tagged strings. */
    entryJson: jsonb("entry_json").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: "run_ledger_entries_pkey", columns: [t.runId, t.seq] }),
    index("run_ledger_entries_step_idx").on(t.runId, t.stepIndex),
    check("run_ledger_entries_seq_nonneg", sql`${t.seq} >= 0`),
    check("run_ledger_entries_step_nonneg", sql`${t.stepIndex} >= 0`),
  ],
).enableRLS();

/** Append-only (H8). Unique on `(run_id, idempotency_key)` (H16). */
export const orders = pgTable(
  "orders",
  {
    id: id(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "restrict" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    side: orderSideEnum("side").notNull(),
    quantity: quantity("quantity").notNull(),
    submittedAt: timestamptz("submitted_at").notNull().defaultNow(),
    idempotencyKey: text("idempotency_key").notNull(),
    stepIndex: integer("step_index").notNull(),
  },
  (t) => [
    uniqueIndex("orders_run_idempotency_key").on(t.runId, t.idempotencyKey),
    index("orders_run_step_idx").on(t.runId, t.stepIndex),
    check("orders_quantity_positive", sql`${t.quantity} > 0`),
    check("orders_step_nonneg", sql`${t.stepIndex} >= 0`),
  ],
).enableRLS();

/** Append-only (H8). */
export const fills = pgTable(
  "fills",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    pricePaise: paise("price_paise").notNull(),
    quantity: quantity("quantity").notNull(),
    executedAt: timestamptz("executed_at").notNull().defaultNow(),
    stepIndex: integer("step_index").notNull(),
  },
  (t) => [
    index("fills_order_idx").on(t.orderId),
    check("fills_price_positive", sql`${t.pricePaise} > 0`),
    check("fills_quantity_positive", sql`${t.quantity} > 0`),
  ],
).enableRLS();

/** Derived only. May be truncated and rebuilt from orders + fills (H13). */
export const holdingsCache = pgTable(
  "holdings_cache",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    quantity: quantity("quantity").notNull(),
    asOfStep: integer("as_of_step").notNull(),
  },
  (t) => [
    primaryKey({
      name: "holdings_cache_pkey",
      columns: [t.runId, t.instrumentId],
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Season portfolio and theses
// ---------------------------------------------------------------------------

export const positions = pgTable(
  "positions",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    openedAt: timestamptz("opened_at").notNull().defaultNow(),
    closedAt: timestamptz("closed_at"),
  },
  (t) => [
    index("positions_user_season_idx").on(t.userId, t.seasonId),
    check(
      "positions_close_after_open",
      sql`${t.closedAt} IS NULL OR ${t.closedAt} >= ${t.openedAt}`,
    ),
  ],
).enableRLS();

/**
 * Immutable after submission (H9): rows are never updated; an edit is a new
 * row with `revision + 1`. The sketch had no revision column; this is the
 * minimum added to model it.
 */
export const theses = pgTable(
  "theses",
  {
    id: id(),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    body: text("body").notNull(),
    keyRisk: text("key_risk").notNull(),
    falsifier: text("falsifier").notNull(),
    submittedAt: timestamptz("submitted_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("theses_position_revision_key").on(t.positionId, t.revision),
    check("theses_revision_positive", sql`${t.revision} >= 1`),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Forecasting and scores
// ---------------------------------------------------------------------------

export const forecastQuestions = pgTable(
  "forecast_questions",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    prompt: text("prompt").notNull(),
    resolutionCriteria: text("resolution_criteria").notNull(),
    closesAt: timestamptz("closes_at").notNull(),
    resolvedAt: timestamptz("resolved_at"),
    /** NULL until resolved. */
    outcome: boolean("outcome"),
    createdAt: createdAt(),
  },
  (t) => [
    index("forecast_questions_season_idx").on(t.seasonId),
    check(
      "forecast_questions_resolution_pair",
      sql`(${t.resolvedAt} IS NULL) = (${t.outcome} IS NULL)`,
    ),
  ],
).enableRLS();

/**
 * One row per (question, user) (H10). Editable until `closes_at`, locked
 * after by trigger against server time (H20). `revised_count` increments on
 * every update so admins can spot last-second flips without a revision table.
 */
export const forecasts = pgTable(
  "forecasts",
  {
    id: id(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => forecastQuestions.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    probability: numeric("probability", { precision: 5, scale: 4 }).notNull(),
    rationale: text("rationale").notNull(),
    submittedAt: timestamptz("submitted_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    revisedCount: integer("revised_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("forecasts_question_user_key").on(t.questionId, t.userId),
    index("forecasts_user_idx").on(t.userId),
    check(
      "forecasts_probability_range",
      sql`${t.probability} >= 0 AND ${t.probability} <= 1`,
    ),
  ],
).enableRLS();

export const scores = pgTable(
  "scores",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    track: text("track").notNull(),
    value: numeric("value", { precision: 14, scale: 4 }).notNull(),
    /** Every rank is explainable to its components (H23). */
    componentsJson: jsonb("components_json").notNull(),
    computedAt: timestamptz("computed_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "scores_pkey",
      columns: [t.userId, t.seasonId, t.track],
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export const researchNotes = pgTable(
  "research_notes",
  {
    id: id(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    instrumentId: uuid("instrument_id").references(() => instruments.id, {
      onDelete: "restrict",
    }),
    /** Added beyond the sketch: `/research/[slug]` needs a title and a slug. */
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    bodyMd: text("body_md").notNull(),
    state: noteStateEnum("state").notNull().default("draft"),
    publishedAt: timestamptz("published_at"),
    createdAt: createdAt(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("research_notes_slug_key").on(t.slug),
    index("research_notes_author_idx").on(t.authorId),
    index("research_notes_season_state_idx").on(t.seasonId, t.state),
    check(
      "research_notes_published_pair",
      sql`(${t.state} = 'published') = (${t.publishedAt} IS NOT NULL)`,
    ),
  ],
).enableRLS();

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => researchNotes.id, { onDelete: "restrict" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    rubricJson: jsonb("rubric_json").notNull(),
    total: integer("total").notNull(),
    submittedAt: timestamptz("submitted_at").notNull().defaultNow(),
  },
  (t) => [index("reviews_note_idx").on(t.noteId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------------

/** Added beyond the sketch: `modules.track_id` needs something to point at. */
export const tracks = pgTable(
  "tracks",
  {
    id: id(),
    name: text("name").notNull(),
    orderIndex: integer("order_index").notNull(),
    description: text("description").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("tracks_name_key").on(t.name),
    uniqueIndex("tracks_order_key").on(t.orderIndex),
  ],
).enableRLS();

export const modules = pgTable(
  "modules",
  {
    id: id(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    /** Publication gated on faculty approval (H29). */
    state: moduleStateEnum("state").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("modules_track_order_key").on(t.trackId, t.orderIndex)],
).enableRLS();

export const progress = pgTable(
  "progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    completedAt: timestamptz("completed_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "progress_pkey", columns: [t.userId, t.moduleId] }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const events = pgTable(
  "events",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    startsAt: timestamptz("starts_at").notNull(),
    capacity: integer("capacity").notNull(),
    location: text("location").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("events_season_idx").on(t.seasonId),
    check("events_capacity_positive", sql`${t.capacity} > 0`),
  ],
).enableRLS();

export const rsvps = pgTable(
  "rsvps",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: rsvpStateEnum("state").notNull().default("going"),
    createdAt: createdAt(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: "rsvps_pkey", columns: [t.eventId, t.userId] })],
).enableRLS();

export const attendance = pgTable(
  "attendance",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    markedBy: uuid("marked_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    markedAt: timestamptz("marked_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "attendance_pkey", columns: [t.eventId, t.userId] }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/** Append-only, never deleted (H8, H31). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    /** NULL for system actions (seed, bootstrap, cron). */
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    /** Required for score overrides (H26); free text. */
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_actor_idx").on(t.actorId),
  ],
).enableRLS();
