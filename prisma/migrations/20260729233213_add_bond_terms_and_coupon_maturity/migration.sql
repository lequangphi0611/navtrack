-- CreateEnum
CREATE TYPE "BondIssuerType" AS ENUM ('CORPORATE', 'GOVERNMENT');

-- AlterEnum
ALTER TYPE "CashflowType" ADD VALUE 'MATURITY';

-- AlterEnum
ALTER TYPE "DividendType" ADD VALUE 'BOND_COUPON';

-- AlterTable
ALTER TABLE "Dividend" ADD COLUMN     "couponFrequencyMonthsApplied" INTEGER,
ADD COLUMN     "couponRatePercentApplied" DECIMAL(20,4),
ADD COLUMN     "parValueApplied" DECIMAL(20,4);

-- CreateTable
CREATE TABLE "BondTerms" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "issuerType" "BondIssuerType" NOT NULL,
    "parValue" DECIMAL(20,4) NOT NULL,
    "couponRatePercent" DECIMAL(20,4),
    "couponFrequencyMonths" INTEGER,
    "firstCouponDate" TIMESTAMP(3),
    "maturityDate" TIMESTAMP(3),
    "nextCouponDateOverride" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BondTerms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BondTerms_holdingId_key" ON "BondTerms"("holdingId");

-- AddForeignKey
ALTER TABLE "BondTerms" ADD CONSTRAINT "BondTerms_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
