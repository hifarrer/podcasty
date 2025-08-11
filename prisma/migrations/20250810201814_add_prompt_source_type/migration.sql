-- AlterEnum
ALTER TYPE "public"."SourceType" ADD VALUE 'PROMPT';

-- AlterTable
ALTER TABLE "public"."Episode" ADD COLUMN     "promptText" TEXT;
