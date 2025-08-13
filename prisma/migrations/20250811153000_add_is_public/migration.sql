-- Add isPublic flag to episodes, defaulting to true for existing rows
ALTER TABLE "public"."Episode" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- Backfill existing rows to true (in case default didn't apply)
UPDATE "public"."Episode" SET "isPublic" = true WHERE "isPublic" IS NULL;

-- Index to support gallery queries
CREATE INDEX IF NOT EXISTS "Episode_isPublic_createdAt_idx" ON "public"."Episode"("isPublic", "createdAt");


