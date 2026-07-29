import type { AssetType } from "@prisma/client";
import { AppError } from "@/lib/settings-resolution";

// BondTerms is 1-1 with Holding via holdingId @unique, but the Prisma relation
// itself cannot enforce holding.type = "BOND" (docs/02-data-model.md, model
// BondTerms). Every write path that creates/updates a BondTerms row must
// enforce that invariant before writing.
//
// `saveBondTerms` (features/holdings/actions.ts) — the only such path today —
// enforces it inline instead of calling this guard, because a user picking the
// wrong holding is an expected outcome that belongs in `ActionResult`, not an
// exception (docs/rules/error-handling.md). Calling this right after that early
// return was dead code (review PR #102) and has been removed.
//
// Kept for write paths that have no user-facing error channel (a seed script, a
// backfill, a future repository-level write): throwing is the right shape
// there. Adding one? Call this first.
export function assertBondHoldingType(holdingType: AssetType): void {
  if (holdingType !== "BOND") {
    throw new AppError(
      "INVALID_HOLDING_TYPE",
      `BondTerms chỉ áp dụng cho Holding loại BOND (nhận "${holdingType}")`,
    );
  }
}
