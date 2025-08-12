-- AlterTable: User adds stripe and subscription columns
ALTER TABLE "public"."User"
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT,
ADD COLUMN     "subscriptionPeriodEnd" TIMESTAMP(3);

-- AlterTable: PlanConfig adds Stripe price IDs
ALTER TABLE "public"."PlanConfig"
ADD COLUMN     "stripePriceMonthlyId" TEXT,
ADD COLUMN     "stripePriceYearlyId" TEXT;


