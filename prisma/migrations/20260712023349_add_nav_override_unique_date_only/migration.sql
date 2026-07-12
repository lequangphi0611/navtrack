-- AlterTable
ALTER TABLE "NavOverride" ALTER COLUMN "date" SET DATA TYPE DATE;

-- CreateIndex
CREATE UNIQUE INDEX "NavOverride_holdingId_date_key" ON "NavOverride"("holdingId", "date");
