import Decimal from "decimal.js";
import { Undo2 } from "lucide-react";

import type { CashflowType } from "@prisma/client";
import { EmptyState } from "@/components/EmptyState";
import type { CashflowTimelineRow } from "@/features/holdings/components/CashflowTimeline";
import {
  getClosedHoldingsDetail,
  getHoldingDetail,
} from "@/features/holdings/queries";
import { getHideAmountsByDefault } from "@/features/settings/queries";
import { assertNever } from "@/lib/assert-never";
import {
  formatDate,
  formatMoney,
  formatMonthYear,
  formatQuantity,
} from "@/lib/format";
import { ROUTES } from "@/lib/routes";

import { ClosedHoldingsList } from "./ClosedHoldingsList";
import { ClosedHoldingsSummaryStrip } from "../ClosedHoldingsSummaryStrip";

// Nhãn dòng lệnh trong timeline "Dòng lệnh của mã" (mockup 6g/6h/6i) — khác
// cấu trúc chuỗi thật sự theo loại (SELL còn tuỳ isFinalSell), không chỉ khác
// từ ngữ đơn thuần. switch exhaustive (docs/rules/typescript-style.md mục
// "Enum") thay vì ternary lồng nhau.
function cashflowLabel(
  cf: { type: CashflowType; quantity: string },
  isFinalSell: boolean,
  unit: string,
): string {
  switch (cf.type) {
    case "BUY":
      return `Mua ${formatQuantity(cf.quantity, unit)}`;
    case "SELL":
      return `${isFinalSell ? "Bán hết" : "Bán"} ${formatQuantity(cf.quantity, unit)}`;
    default:
      return assertNever(cf.type);
  }
}

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
// orders GHÉP THÊM cổ tức tiền mặt (row.cashDividends, đã batch sẵn ở
// getClosedHoldingsDetail) — không round-trip DB riêng.
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
      .reduce(
        (sum, cf) => sum.plus(new Decimal(cf.amount).abs()),
        new Decimal(0),
      )
      .toString();
    const totalProceeds = ascending
      .filter((cf) => cf.type === "SELL")
      .reduce((sum, cf) => sum.plus(cf.amount), new Decimal(0))
      .toString();

    // Cổ tức tiền mặt nhận được lúc vị thế còn mở — "Chênh lệch (đã chốt)"
    // (row.realizedPnl, từ getClosedHoldingsDetail) CỘNG GỘP cả khoản này
    // (buildXirrCashflows đưa dividend.netAmount vào chuỗi XIRR), nên phải
    // hiện thành khoản riêng thì "Tổng mua/Tổng bán/Chênh lệch" mới khớp phép
    // cộng trừ hiển thị (code review #3) — KHÔNG gộp ngầm vào "Tổng tiền bán
    // ra" (label đó nói rõ "bán ra", không phải cổ tức).
    const totalDividends = row.cashDividends
      .reduce((sum, d) => sum.plus(d.netAmount), new Decimal(0))
      .toString();

    // Ghép dòng BUY/SELL + dòng cổ tức tiền mặt thành 1 timeline, sort theo
    // ngày — cùng kỹ thuật buildCashflowTimeline() (build-cashflow-timeline.ts)
    // nhưng KHÔNG tái dùng thẳng hàm đó: nhánh vị thế đã đóng cần label "Bán
    // hết" riêng cho lệnh bán cuối (buildCashflowTimeline chỉ có "Mua"/"Bán").
    const cashflowEntries: { row: CashflowTimelineRow; sortDate: number }[] =
      ascending.map((cf, cfIndex) => {
        const isFinalSell =
          cfIndex === ascending.length - 1 && cf.type === "SELL";
        return {
          row: {
            id: cf.id,
            kind: cf.type,
            label: cashflowLabel(cf, isFinalSell, detail?.unit ?? ""),
            dateNote: `${formatDate(cf.date)} · giá ${formatMoney(cf.pricePerUnit)}`,
            amount: cf.amount,
          },
          sortDate: new Date(cf.date).getTime(),
        };
      });

    const dividendEntries: { row: CashflowTimelineRow; sortDate: number }[] =
      row.cashDividends.map((d) => {
        const displayDate = d.paymentDate ?? d.date;
        return {
          row: {
            id: d.id,
            kind: "DIVIDEND",
            label: "Cổ tức tiền mặt",
            dateNote: `${formatDate(displayDate)} · cổ tức tiền mặt`,
            amount: d.netAmount,
          },
          sortDate: new Date(displayDate).getTime(),
        };
      });

    const orders: CashflowTimelineRow[] = [
      ...cashflowEntries,
      ...dividendEntries,
    ]
      .sort((a, b) => a.sortDate - b.sortDate)
      .map((entry) => entry.row);

    const firstDate = ascending[0]?.date;
    const lastDate = ascending[ascending.length - 1]?.date;

    return {
      ...row,
      startMonthLabel: firstDate ? formatMonthYear(firstDate) : "",
      endMonthLabel: lastDate ? formatMonthYear(lastDate) : "",
      totalInvested,
      totalProceeds,
      totalDividends,
      orders,
      reopenHref: ROUTES.newTransaction(row.id),
      detailHref: ROUTES.holdingDetail(row.id),
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
