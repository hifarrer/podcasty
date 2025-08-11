-- AlterTable
ALTER TABLE "public"."Episode" ADD COLUMN     "speakers" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "voicesJson" JSONB;
