CREATE TABLE "run_ledger_entries" (
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"step_index" integer NOT NULL,
	"trade_date" date NOT NULL,
	"kind" text NOT NULL,
	"entry_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_ledger_entries_pkey" PRIMARY KEY("run_id","seq"),
	CONSTRAINT "run_ledger_entries_seq_nonneg" CHECK ("run_ledger_entries"."seq" >= 0),
	CONSTRAINT "run_ledger_entries_step_nonneg" CHECK ("run_ledger_entries"."step_index" >= 0)
);
--> statement-breakpoint
ALTER TABLE "run_ledger_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "engine_state" jsonb;--> statement-breakpoint
ALTER TABLE "run_ledger_entries" ADD CONSTRAINT "run_ledger_entries_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_ledger_entries_step_idx" ON "run_ledger_entries" USING btree ("run_id","step_index");--> statement-breakpoint
-- The ledger is append-only (H13), enforced here rather than trusted to the
-- application, exactly as orders, fills and audit_log are.
CREATE TRIGGER run_ledger_entries_append_only BEFORE UPDATE OR DELETE ON run_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION wows_reject_mutation();--> statement-breakpoint
CREATE TRIGGER run_ledger_entries_no_truncate BEFORE TRUNCATE ON run_ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION wows_reject_mutation();--> statement-breakpoint

-- A member reads and writes only their own ledger (H2), exactly as for orders
-- and fills, and using the same helper so the three cannot drift apart.
CREATE POLICY run_ledger_entries_select ON run_ledger_entries FOR SELECT TO wows_app
  USING (owner_of_run(run_id) = app_user_id() OR app_is_staff());--> statement-breakpoint
CREATE POLICY run_ledger_entries_insert ON run_ledger_entries FOR INSERT TO wows_app
  WITH CHECK (owner_of_run(run_id) = app_user_id());--> statement-breakpoint
GRANT SELECT, INSERT ON run_ledger_entries TO wows_app;--> statement-breakpoint

-- One ranked attempt per member per game instance (section 9). The
-- application also checks across every game instance of the same scenario
-- version, which a partial index cannot express because it cannot join; this
-- is the backstop for the common case.
CREATE UNIQUE INDEX runs_one_ranked_attempt
  ON runs (user_id, game_instance_id) WHERE mode = 'ranked';
