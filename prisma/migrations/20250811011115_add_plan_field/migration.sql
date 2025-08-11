-- CreateEnum
CREATE TYPE "public"."PlanType" AS ENUM ('FREE', 'BASIC', 'PREMIUM');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "plan" "public"."PlanType" NOT NULL DEFAULT 'FREE';
