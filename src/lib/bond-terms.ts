import type { AssetType } from "@prisma/client";
import { AppError } from "@/lib/settings-resolution";

// BondTerms is 1-1 with Holding via holdingId @unique, but the Prisma relation
// itself cannot enforce holding.type = "BOND" (docs/02-data-model.md, model
// BondTerms). Every write path that creates/updates a BondTerms row must call
// this guard first — throwing is correct here (lỗi lường trước ở tầng validate,
// không phải kết quả nghiệp vụ hợp lệ, xem docs/rules/error-handling.md).
export function assertBondHoldingType(holdingType: AssetType): void {
  if (holdingType !== "BOND") {
    throw new AppError(
      "INVALID_HOLDING_TYPE",
      `BondTerms chỉ áp dụng cho Holding loại BOND (nhận "${holdingType}")`,
    );
  }
}
