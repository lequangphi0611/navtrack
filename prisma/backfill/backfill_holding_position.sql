-- One-off backfill for Holding.quantity / Holding.avgCost (materialized position cache),
-- introduced by migration 20260711081325_add_holding_position_cache.
--
-- Run ONCE per database (local + production) right after applying that migration, to seed
-- pre-existing Holding rows whose new columns defaulted to 0. Idempotent: it recomputes the
-- values from Cashflow, so re-running is safe. From here on the app keeps these columns
-- correct in-transaction (src/features/holdings/actions.ts -> persistPosition), so this
-- script is only needed for rows that existed before the migration.
--
-- WARNING: this is a hand-written SQL REPLICA of derivePosition() in src/lib/cost-basis.ts
-- (moving-average cost basis, resetting avg cost to 0 when the position closes exactly at 0).
-- If that logic ever changes, update this file too. See process/DECISION.md for why the
-- position is materialized despite the "derived, not stored" domain note.

WITH RECURSIVE ordered AS (
  SELECT
    c."holdingId",
    row_number() OVER (
      PARTITION BY c."holdingId"
      ORDER BY c."date", c."createdAt", c."id"
    ) AS rn,
    c."type",
    c."quantity",
    c."pricePerUnit"
  FROM "Cashflow" c
),
walk AS (
  -- Base: first cashflow of each holding, folded from quantity 0 / avg cost 0.
  SELECT
    o."holdingId",
    o.rn,
    CASE WHEN o."type" = 'BUY' THEN o."quantity" ELSE -o."quantity" END AS quantity,
    CASE WHEN o."type" = 'BUY' THEN o."pricePerUnit" ELSE 0 END AS avg_cost
  FROM ordered o
  WHERE o.rn = 1

  UNION ALL

  -- Step: fold the next cashflow in date order (matches the sequential replay in derivePosition).
  SELECT
    o."holdingId",
    o.rn,
    w.quantity + CASE WHEN o."type" = 'BUY' THEN o."quantity" ELSE -o."quantity" END AS quantity,
    CASE
      WHEN o."type" = 'BUY' THEN
        CASE
          WHEN (w.quantity + o."quantity") = 0 THEN 0
          ELSE (w.quantity * w.avg_cost + o."quantity" * o."pricePerUnit")
               / (w.quantity + o."quantity")
        END
      ELSE
        -- SELL: avg cost is unchanged; reset to 0 only when the position closes exactly at 0.
        CASE WHEN (w.quantity - o."quantity") = 0 THEN 0 ELSE w.avg_cost END
    END AS avg_cost
  FROM walk w
  JOIN ordered o
    ON o."holdingId" = w."holdingId"
   AND o.rn = w.rn + 1
),
final AS (
  -- Last fold per holding = current position.
  SELECT DISTINCT ON (w."holdingId")
    w."holdingId",
    w.quantity,
    w.avg_cost
  FROM walk w
  ORDER BY w."holdingId", w.rn DESC
)
UPDATE "Holding" h
SET
  "quantity" = f.quantity,
  "avgCost"  = f.avg_cost
FROM final f
WHERE h."id" = f."holdingId";
