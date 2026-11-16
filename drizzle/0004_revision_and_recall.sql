ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "current_revision" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "eval_cases" ADD COLUMN IF NOT EXISTS "recall_at_5" real;
--> statement-breakpoint
ALTER TABLE "eval_cases" ADD COLUMN IF NOT EXISTS "recall_at_10" real;
