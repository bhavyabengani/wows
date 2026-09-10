CREATE TABLE "rate_limits" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_pkey" PRIMARY KEY("bucket","window_start"),
	CONSTRAINT "rate_limits_count_nonneg" CHECK ("rate_limits"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Counters are the app's own bookkeeping, not member data. The application
-- role may read and write its own buckets; nothing else needs them, and RLS
-- stays on so an unpolicied table can never be readable by default.
CREATE POLICY rate_limits_all ON rate_limits FOR ALL TO wows_app
  USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO wows_app;
