ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "embedding_status" text DEFAULT 'idle' NOT NULL;
ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "embedding_started_at" timestamp;
