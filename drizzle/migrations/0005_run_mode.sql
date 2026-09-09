CREATE TYPE "public"."run_mode" AS ENUM('ranked', 'practice');--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "mode" "run_mode" DEFAULT 'practice' NOT NULL;--> statement-breakpoint
-- Defaults to 'practice' so that nothing existing silently becomes ranked, and
-- so a run has to be deliberately marked as the one that counts.
