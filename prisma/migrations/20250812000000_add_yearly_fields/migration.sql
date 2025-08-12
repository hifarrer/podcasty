-- AlterTable
ALTER TABLE "public"."PlanConfig"
ADD COLUMN     "yearlyPriceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "yearlyLimit" INTEGER NOT NULL DEFAULT 0;


