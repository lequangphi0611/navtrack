import Decimal from "decimal.js";

import type { HoldingValuation, PriceSource } from "@/lib/valuation";

// Một dòng Snapshot{holdingId, period: MANUAL} cần ghi cho 1 vị thế đang mở đã
// định giá được (status VALUED) — value/source lấy thẳng từ HoldingValuation,
// không tính lại (nguồn sự thật vẫn là valuateHoldings()).
export type ManualSnapshotHoldingWrite = {
  holdingId: string;
  value: Decimal;
  source: PriceSource;
};

export type ManualSnapshotPlan = {
  holdingWrites: ManualSnapshotHoldingWrite[];
  // null = KHÔNG ghi dòng tổng danh mục ở mốc này (toàn bộ Holding đang mở đều
  // thiếu giá — 0 sẽ sai, docs/domain/06-snapshots.md mục "Ca biên").
  aggregate: { value: Decimal; isPartial: boolean } | null;
  // holdingId của các vị thế đang mở nhưng KHÔNG resolve được giá tại mốc —
  // không ghi dòng Snapshot riêng cho các holding này (không mặc định 0).
  missingHoldingIds: string[];
};

// Pure — không đụng DB, để unit test được. Mirror ca biên của
// jobs/snapshot-cron/main.py::run_snapshot (đồng bộ thủ công, xem
// docs/domain/06-snapshots.md mục "Ca biên", process/DECISION.md 2026-07-14):
// - Holding đang mở không resolve được giá -> bỏ dòng riêng, gom vào
//   missingHoldingIds (không mặc định 0).
// - Còn >= 1 Holding định giá được -> aggregate = tổng các Holding đã biết,
//   isPartial = true khi có Holding thiếu giá.
// - Toàn bộ Holding đang mở đều thiếu giá -> aggregate = null (bỏ hẳn dòng
//   tổng, KHÔNG phải 0).
// - Không có Holding nào đang mở (openHoldingIds rỗng) -> aggregate = 0, số
//   thật (đã bán hết/chưa từng mua), vẫn ghi.
export function planManualSnapshot(
  openHoldingIds: string[],
  valuations: Map<string, HoldingValuation>,
): ManualSnapshotPlan {
  const holdingWrites: ManualSnapshotHoldingWrite[] = [];
  const missingHoldingIds: string[] = [];

  for (const holdingId of openHoldingIds) {
    const valuation = valuations.get(holdingId);
    if (valuation?.status === "VALUED") {
      holdingWrites.push({
        holdingId,
        value: valuation.nav,
        source: valuation.source,
      });
    } else {
      // MISSING_PRICE là ca thật duy nhất mong đợi ở đây — CLOSED/absent chỉ
      // là phòng thủ (openHoldingIds luôn là vị thế quantity > 0, valuateHolding
      // không thể trả CLOSED cho input đó), gộp chung xử lý "bỏ qua, không mặc định 0".
      missingHoldingIds.push(holdingId);
    }
  }

  if (openHoldingIds.length === 0) {
    return {
      holdingWrites,
      aggregate: { value: new Decimal(0), isPartial: false },
      missingHoldingIds,
    };
  }

  if (holdingWrites.length === 0) {
    return { holdingWrites, aggregate: null, missingHoldingIds };
  }

  const value = holdingWrites.reduce(
    (sum, write) => sum.plus(write.value),
    new Decimal(0),
  );

  return {
    holdingWrites,
    aggregate: { value, isPartial: missingHoldingIds.length > 0 },
    missingHoldingIds,
  };
}
