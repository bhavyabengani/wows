CREATE TABLE "snapshots" (
	"version" integer PRIMARY KEY NOT NULL,
	"built_at" timestamp with time zone NOT NULL,
	"fetch_date" date NOT NULL,
	"is_adjusted" boolean NOT NULL,
	"adjusted_as_of" date NOT NULL,
	"price_basis" text NOT NULL,
	"dividends_included" boolean NOT NULL,
	"fd_series_verified" boolean NOT NULL,
	"bars_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshots_version_positive" CHECK ("snapshots"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Same access shape as price_bars, which this table describes: any
-- participant may read it, only core may write it, and in practice only the
-- snapshot loader ever does.
CREATE POLICY snapshots_select ON snapshots FOR SELECT TO wows_app USING (app_is_participant());--> statement-breakpoint
CREATE POLICY snapshots_insert ON snapshots FOR INSERT TO wows_app WITH CHECK (app_is_core());--> statement-breakpoint
GRANT SELECT, INSERT ON snapshots TO wows_app;
