-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'FUND', 'BOND', 'GOLD');

-- CreateEnum
CREATE TYPE "CashflowType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "DividendType" AS ENUM ('CASH', 'STOCK');

-- CreateEnum
CREATE TYPE "SnapshotSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "SnapshotPeriod" AS ENUM ('PERIODIC', 'YEAR_END', 'MANUAL', 'TODAY');

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('DECIMAL', 'INT', 'STRING', 'BOOLEAN', 'DATE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "hideAmountsByDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllowedUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "canInvite" BOOLEAN NOT NULL DEFAULT false,
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AllowedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'cổ phần',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cashflow" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "type" "CashflowType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL,
    "pricePerUnit" DECIMAL(20,4) NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "taxAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "feeAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cashflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dividend" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "type" "DividendType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "grossAmount" DECIMAL(20,4),
    "taxAmount" DECIMAL(20,4),
    "netAmount" DECIMAL(20,4),
    "stockQuantity" DECIMAL(20,4),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(20,4) NOT NULL,
    "source" "SnapshotSource" NOT NULL,
    "period" "SnapshotPeriod" NOT NULL,
    "frozen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavOverride" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(20,4) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceQuote" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DECIMAL(20,4) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" "SettingValueType" NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "unit" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AllowedUser_email_key" ON "AllowedUser"("email");

-- CreateIndex
CREATE INDEX "Holding_userId_idx" ON "Holding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_userId_symbol_type_key" ON "Holding"("userId", "symbol", "type");

-- CreateIndex
CREATE INDEX "Cashflow_holdingId_date_idx" ON "Cashflow"("holdingId", "date");

-- CreateIndex
CREATE INDEX "Dividend_holdingId_date_idx" ON "Dividend"("holdingId", "date");

-- CreateIndex
CREATE INDEX "Snapshot_holdingId_date_idx" ON "Snapshot"("holdingId", "date");

-- CreateIndex
CREATE INDEX "NavOverride_holdingId_date_idx" ON "NavOverride"("holdingId", "date");

-- CreateIndex
CREATE INDEX "PriceQuote_symbol_date_idx" ON "PriceQuote"("symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceQuote_symbol_date_key" ON "PriceQuote"("symbol", "date");

-- CreateIndex
CREATE INDEX "Setting_key_effectiveFrom_idx" ON "Setting"("key", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_effectiveFrom_key" ON "Setting"("key", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cashflow" ADD CONSTRAINT "Cashflow_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NavOverride" ADD CONSTRAINT "NavOverride_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
