-- CreateIndex
-- Partial unique index — at most one frozen portfolio-total snapshot per
-- (userId, date, period) when holdingId is null. Not expressible as @@unique
-- in schema.prisma (no WHERE support) — see NOTE next to model Snapshot.
CREATE UNIQUE INDEX "Snapshot_portfolio_unique" ON "Snapshot"("userId", "date", "period") WHERE "holdingId" IS NULL;

-- CreateIndex
-- Partial unique index — at most one frozen per-holding snapshot per
-- (holdingId, date, period) when holdingId is not null.
CREATE UNIQUE INDEX "Snapshot_holding_unique" ON "Snapshot"("holdingId", "date", "period") WHERE "holdingId" IS NOT NULL;
