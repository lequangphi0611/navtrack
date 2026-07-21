import Decimal from "decimal.js";
import { Undo2 } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import type { CashflowTimelineRow } from "@/features/holdings/components/CashflowTimeline";
import {
  getClosedHoldingsDetail,
  getHoldingDetail,
} from "@/features/holdings/queries";
import { getHideAmountsByDefault } from "@/features/settings/queries";
import {
  formatDate,
  formatMoney,
  formatMonthYear,
  formatQuantity,
} from "@/lib/format";
import { ROUTES } from "@/lib/routes";

import { ClosedHoldingsList } from "./ClosedHoldingsList";
import { ClosedHoldingsSummaryStrip } from "../ClosedHoldingsSummaryStrip";

// Container async cho tab "Đã đóng" (mockup 6g/6h/6i, mục 12 phase-6.md) —
// THAY HẲN nhánh status="closed" cũ trong HoldingsPositionsSection (bỏ
// <HoldingsList> gom nhóm theo AssetType, vốn sai bố cục cho vị thế đã đóng —
// xem process/phase-6.md dòng "sai bố cục 6g/6h (list phẳng)").
//
// Timeline "Dòng lệnh của mã" cho ClosedPositionSheet cần cashflows RIÊNG từng
// holding — gọi getHoldingDetail() (đã có, KHÔNG phải query mới) song song cho
// mọi vị thế đã đóng, tính sẵn orders/vốn mua/tiền bán ra ngay ở Container để
// ClosedPositionSheet (Presentational, client) không tự fetch khi mở (mirror
// tiền lệ: mọi dữ liệu Sheet đều là props, xem component-architecture.md).
async function ClosedHoldingsSection() {
  const [{ rows, summary }, hidden] = await Promise.all([
    getClosedHoldingsDetail(),
    getHideAmountsByDefault(),
  ]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Undo2}
        title="Chưa có vị thế nào đã đóng"
        description="Vị thế đóng khi bạn bán hết số lượng đang giữ."
      />
    );
  }

  const details = await Promise.all(
    rows.map((row) => getHoldingDetail(row.id)),
  );

  const rowsWithSheetData = rows.map((row, index) => {
    const detail = details[index];
    // cashflows đã fetch = [...].reverse() (mới nhất trước, xem getHoldingDetail)
    // — đảo lại để dựng timeline THEO THỜI GIAN (mua trước, bán sau).
    const ascending = detail ? [...detail.cashflows].reverse() : [];

    const totalInvested = ascending
      .filter((cf) => cf.type === "BUY")
      .reduce((sum, cf) => sum.plus(cf.amount.replace("-", "")), new Decimal(0))
      .toString();
    const totalProceeds = ascending
      .filter((cf) => cf.type === "SELL")
      .reduce((sum, cf) => sum.plus(cf.amount), new Decimal(0))
      .toString();

    const orders: CashflowTimelineRow[] = ascending.map((cf, cfIndex) => {
      const isFinalSell =
        cfIndex === ascending.length - 1 && cf.type === "SELL";
      return {
        id: cf.id,
        kind: cf.type,
        label: `${cf.type === "BUY" ? "Mua" : isFinalSell ? "Bán hết" : "Bán"} ${formatQuantity(cf.quantity, detail?.unit ?? "")}`,
        dateNote: `${formatDate(cf.date)} · giá ${formatMoney(cf.pricePerUnit)}`,
        amount: cf.amount,
      };
    });

    const firstDate = ascending[0]?.date;
    const lastDate = ascending[ascending.length - 1]?.date;

    return {
      ...row,
      startMonthLabel: firstDate ? formatMonthYear(firstDate) : "",
      endMonthLabel: lastDate ? formatMonthYear(lastDate) : "",
      totalInvested,
      totalProceeds,
      orders,
      reopenHref: ROUTES.newTransaction(row.id),
    };
  });

  return (
    <div className="flex flex-col gap-3.5">
      <ClosedHoldingsSummaryStrip
        totalRealizedPnl={summary.totalRealizedPnl}
        averageXirrRealized={summary.averageXirrRealized}
        hidden={hidden}
      />
      <ClosedHoldingsList rows={rowsWithSheetData} hidden={hidden} />
      <div className="rounded-xl border border-border bg-card p-3.5 text-[11px] leading-relaxed text-muted-faint">
        Vị thế đã đóng = số lượng đang giữ bằng 0. Số liệu đã khoá tại lần bán
        cuối, không đổi theo mốc chốt hay giá cập nhật về sau — vị thế đã đóng
        không bao giờ có badge cảnh báo tập trung.
      </div>
    </div>
  );
}

export { ClosedHoldingsSection };
