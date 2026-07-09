/*
  Warnings:

  - Added the required column `userId` to the `Snapshot` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Holding_userId_idx";

-- DropIndex
DROP INDEX "PriceQuote_symbol_date_idx";

-- DropIndex
DROP INDEX "Setting_key_effectiveFrom_idx";

-- AlterTable
ALTER TABLE "Holding" ALTER COLUMN "unit" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Snapshot_userId_date_idx" ON "Snapshot"("userId", "date");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
