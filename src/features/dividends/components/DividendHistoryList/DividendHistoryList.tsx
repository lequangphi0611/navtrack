import { Coins, Layers, ReceiptText } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { formatMoney, formatQuantity } from "@/lib/format";

import { DividendRowsFilter } from "./DividendRowsFilter";

// Một dòng lịch sử cổ tức (mockup Phase 4 Screens, 4e) — scope THEO TỪNG
// Holding (không portfolio-wide, khác Snapshot — xem process/UI_phase_4.md
// mục "Điểm lệch so với plan"). `type` giữ raw enum, label suy trong
// DividendRowsFilter (tiền lệ Snapshot badge — xem SnapshotHistoryList).
type DividendHistoryRow = {
  id: string;
  type: "CASH" | "STOCK";
  percentLabel: string; // "20" — hiển thị "Tiền mặt 20%"/"Cổ phiếu 20%"
  date: string; // đã format dd/MM/yyyy
  isNew?: boolean; // badge "MỚI" — lần vừa ghi
  unit?: string; // đơn vị số lượng (CASH không cần, STOCK bắt buộc để format quantity)
  // CASH
  grossAmount?: string;
  taxAmount?: string;
  netAmount?: string;
  // STOCK
  quantityBefore?: string;
  quantityAfter?: string;
  addedQuantity?: string;
  note?: string;
};

type DividendHistorySummary = {
  cashNetTotal: string;
  cashCount: number;
  stockAddedQuantityTotal: string;
  stockCount: number;
  unit: string; // đơn vị số lượng cổ phiếu thưởng (Holding.unit)
};

type DividendHistoryListProps = {
  summary: DividendHistorySummary;
  rows: DividendHistoryRow[];
  hidden?: boolean;
  // Link "Ghi cổ tức" trong lời mời hành động khi rỗng (component-architecture.md
  // — empty state phải là lời mời hành động, không để trống trơn). Màn lịch sử
  // đầy đủ (rows > 0) KHÔNG có CTA này (khác Phase 3) — xem mockup 4e chỉ có
  // back + tiêu đề, không nút "+"/"Ghi cổ tức".
  newDividendHref: string;
};

// Danh sách lịch sử cổ tức của MỘT Holding (mockup 4e) — mirror khung
// SnapshotHistoryList (header + card rows), khác ở chỗ có thêm 2 thẻ tổng hợp
// (tiền mặt/cổ phiếu) và chip lọc CASH/STOCK (DividendRowsFilter, client leaf).
function DividendHistoryList({
  summary,
  rows,
  hidden = false,
  newDividendHref,
}: DividendHistoryListProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Chưa có cổ tức nào được ghi nhận"
        description="Ghi nhận cổ tức tiền mặt hoặc cổ phiếu đầu tiên cho mã này."
        action={
          <Link
            href={newDividendHref}
            className="text-[12.5px] font-semibold text-primary"
          >
            Ghi cổ tức
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-gain/24 bg-linear-to-br from-gain/10 to-card p-3.75">
          <div className="flex items-center gap-1.25 text-[10.5px] font-semibold tracking-wide text-gain uppercase">
            <Coins className="size-3.25" />
            Tiền mặt (net)
          </div>
          <div className="mt-1.25 font-mono text-[19px] font-bold text-gain">
            {formatMoney(summary.cashNetTotal, { hidden, compact: true })}
          </div>
          <div className="mt-0.5 text-[10.5px] text-muted-faint">
            {summary.cashCount} lần · sau thuế
          </div>
        </div>
        <div className="rounded-2xl border border-accent/24 bg-linear-to-br from-accent/10 to-card p-3.75">
          <div className="flex items-center gap-1.25 text-[10.5px] font-semibold tracking-wide text-accent uppercase">
            <Layers className="size-3.25" />
            Cổ phiếu thưởng
          </div>
          <div className="mt-1.25 font-mono text-[19px] font-bold text-accent">
            +{formatQuantity(summary.stockAddedQuantityTotal, summary.unit)}
          </div>
          <div className="mt-0.5 text-[10.5px] text-muted-faint">
            {summary.stockCount} lần
          </div>
        </div>
      </div>

      <DividendRowsFilter rows={rows} hidden={hidden} />
    </div>
  );
}

export { DividendHistoryList };
export type {
  DividendHistoryListProps,
  DividendHistoryRow,
  DividendHistorySummary,
};
