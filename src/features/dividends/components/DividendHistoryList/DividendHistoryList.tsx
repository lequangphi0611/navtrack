import { Coins, Info, Layers, ReceiptText } from "lucide-react";
import Link from "next/link";

import type { DividendType } from "@prisma/client";
import { EmptyState } from "@/components/EmptyState";
import { formatMoney, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DividendRowsFilter } from "./DividendRowsFilter";

// Một dòng lịch sử cổ tức (mockup Phase 4 Screens, 4e) — scope THEO TỪNG
// Holding (không portfolio-wide, khác Snapshot — xem process/UI_phase_4.md
// mục "Điểm lệch so với plan"). `type` giữ raw enum, label suy trong
// DividendRowsFilter (tiền lệ Snapshot badge — xem SnapshotHistoryList).
type DividendHistoryRow = {
  id: string;
  type: DividendType;
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
  // BOND_COUPON (Phase 7) — điều khoản ĐÃ ĐÓNG BĂNG tại thời điểm ghi
  // (Dividend.couponRatePercentApplied/parValueApplied, issue #56), KHÔNG đọc
  // lại BondTerms hiện tại: sửa điều khoản sau này không được làm đổi con số
  // của các kỳ đã ghi (process/phase-7.md "Tiêu chí hoàn thành").
  couponRatePercentApplied?: string; // "9" -> "9%/năm"
  couponFrequencyMonths?: number; // 6 -> "kỳ 6 tháng"
  // true khi kỳ này miễn thuế theo luật (trái phiếu Chính phủ) — hiện badge
  // "MIỄN THUẾ" thay vì để người dùng tưởng app quên tính thuế.
  isTaxExempt?: boolean;
  // BOND_COUPON — true khi user đã sửa tay grossAmount lúc ghi kỳ này (khác
  // computed từ BondTerms, vd lãi suất thả nổi) — cờ audit, độc lập với điều
  // khoản đã đóng băng phía trên (docs/domain/03-dividends.md).
  grossAmountOverridden?: boolean;
};

type DividendHistorySummary = {
  cashNetTotal: string;
  cashCount: number;
  stockAddedQuantityTotal: string;
  stockCount: number;
  unit: string; // đơn vị số lượng cổ phiếu thưởng (Holding.unit)
  // Chỉ có mặt với Holding loại BOND (Phase 7) — vắng mặt thì không hiện thẻ
  // "Trái tức", giữ nguyên layout 2 thẻ của Phase 4 cho cổ phiếu/quỹ.
  bondCouponNetTotal?: string;
  bondCouponCount?: number;
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

  // Thẻ "Trái tức" chỉ xuất hiện với vị thế trái phiếu (mockup 7d) — cổ phiếu/
  // quỹ giữ nguyên 2 thẻ như Phase 4, không hiện một ô 0 ₫ vô nghĩa.
  const hasBondCouponSummary = summary.bondCouponNetTotal !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "grid gap-2.5",
          hasBondCouponSummary ? "grid-cols-3" : "grid-cols-2",
        )}
      >
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
        {hasBondCouponSummary ? (
          <div className="rounded-2xl border border-asset-bond/34 bg-linear-to-br from-asset-bond/16 to-card p-3.75">
            <div className="flex items-center gap-1.25 text-[10.5px] font-semibold tracking-wide text-asset-bond uppercase">
              <ReceiptText className="size-3.25" />
              Trái tức
            </div>
            <div className="mt-1.25 font-mono text-[19px] font-bold text-asset-bond">
              {formatMoney(summary.bondCouponNetTotal ?? "0", {
                hidden,
                compact: true,
              })}
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted-faint">
              {summary.bondCouponCount ?? 0} kỳ · sau thuế
            </div>
          </div>
        ) : null}
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

      {hasBondCouponSummary ? (
        <div className="flex gap-2.25 rounded-xl border border-border bg-white/3 p-3.25">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-faint" />
          <span className="text-[10.5px] leading-relaxed text-muted-faint">
            Dòng phụ ghi{" "}
            <span className="text-muted-foreground">
              điều khoản áp dụng tại thời điểm ghi
            </span>{" "}
            — nếu sau này bạn sửa điều khoản, các kỳ đã ghi vẫn giữ nguyên con
            số cũ.
          </span>
        </div>
      ) : null}
    </div>
  );
}

export { DividendHistoryList };
export type {
  DividendHistoryListProps,
  DividendHistoryRow,
  DividendHistorySummary,
};
