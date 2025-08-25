-- Add VIDEO_RENDER to EpisodeStatus enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'EpisodeStatus' AND e.enumlabel = 'VIDEO_RENDER') THEN
    ALTER TYPE "public"."EpisodeStatus" ADD VALUE 'VIDEO_RENDER';
  END IF;
END$$;

-- Add videoUrl column to Episode if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Episode' AND column_name = 'videoUrl'
  ) THEN
    ALTER TABLE "public"."Episode" ADD COLUMN "videoUrl" TEXT;
  END IF;
END$$;

-- Create Media table if not exists
CREATE TABLE IF NOT EXISTS "public"."Media" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "key" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index for gallery queries
CREATE INDEX IF NOT EXISTS "Media_userId_createdAt_idx" ON "public"."Media"("userId", "createdAt");

