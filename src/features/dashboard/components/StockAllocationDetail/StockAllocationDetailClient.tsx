"use client";

import { useMemo, useState, useTransition } from "react";

import { setHideAmountsByDefault } from "@/features/settings/actions";
import { formatMoney, formatQuantity } from "@/lib/format";
import type {
  StockAllocationDetailData,
  StockAllocationEntry,
} from "@/lib/portfolio-valuation";

import { StockAllocationDetail } from "./StockAllocationDetail";

type SortOrder = "PERCENT_DESC" | "SYMBOL_ASC";

const SORT_LABEL: Record<SortOrder, string> = {
  PERCENT_DESC: "% giảm dần",
  SYMBOL_ASC: "Theo mã A→Z",
};

function sortEntries(
  entries: StockAllocationEntry[],
  order: SortOrder,
): StockAllocationEntry[] {
  // `entries` từ getStockAllocationDetail() đã sort sẵn giảm dần theo percent
  // (computeStockGroupAllocation) — chỉ cần re-sort khi user đổi sang A→Z, đổi
  // lại "% giảm dần" thì dùng nguyên thứ tự gốc, không sort lại 2 lần.
  if (order === "PERCENT_DESC") {
    return [...entries].sort((a, b) => b.percent - a.percent);
  }
  return [...entries].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

type StockAllocationDetailClientProps = Pick<
  StockAllocationDetailData,
  "groupNav" | "entries" | "missingPriced"
> & {
  backHref: string;
  // Đọc từ User.hideAmountsByDefault (server) — khởi tạo state local, cùng
  // pattern DashboardScreenClient (process/DECISION.md 2026-07-21 mục (1)).
  initialHidden: boolean;
};

// Client wrapper DUY NHẤT của StockAllocationDetail (organism, KHÔNG được
// "use client" — component-architecture.md "Cấm 'use client' ở *Screen") —
// giữ 2 state cục bộ KHÔNG cần round-trip DB lại: `hidden` (ẩn số tiền, persist
// qua Server Action giống DashboardScreenClient) và `sortOrder` (đổi thứ tự
// hiển thị thuần trên dữ liệu client đã có, KHÔNG có Server Action nào — sort
// không phải state cần lưu lại giữa các phiên, mockup không yêu cầu nhớ lựa
// chọn). Tự formatMoney()/formatQuantity() ở đây (không phải trong
// getStockAllocationDetail()) vì `hidden` chỉ xác định được ở client sau khi
// mount — StockAllocationDetail nhận field đã format sẵn theo đúng Props
// contract từ #131 (navLabel/groupNavLabel/quantityLabel là string, không
// phải Decimal thô).
function StockAllocationDetailClient({
  backHref,
  initialHidden,
  groupNav,
  entries,
  missingPriced,
}: StockAllocationDetailClientProps) {
  const [hidden, setHidden] = useState(initialHidden);
  const [sortOrder, setSortOrder] = useState<SortOrder>("PERCENT_DESC");
  const [, startTransition] = useTransition();

  const handleToggleHidden = () => {
    // startTransition ở TOP-LEVEL handler (không lồng trong updater của
    // setHidden) — cùng lý do đã ghi ở DashboardScreenClient.tsx (tránh
    // "Cannot call startTransition while rendering").
    const previous = hidden;
    const next = !previous;
    setHidden(next);
    startTransition(() => {
      void setHideAmountsByDefault(next)
        .then((result) => {
          if (!result.ok) setHidden(previous);
        })
        .catch(() => {
          setHidden(previous);
        });
    });
  };

  const handleToggleSort = () => {
    setSortOrder((prev) =>
      prev === "PERCENT_DESC" ? "SYMBOL_ASC" : "PERCENT_DESC",
    );
  };

  const sortedEntries = useMemo(
    () => sortEntries(entries, sortOrder),
    [entries, sortOrder],
  );

  const rows = useMemo(
    () =>
      sortedEntries.map((entry) => ({
        holdingId: entry.holdingId,
        symbol: entry.symbol,
        name: entry.name,
        navLabel: formatMoney(entry.nav, { hidden }),
        percent: entry.percent,
        concentrationBadge: entry.concentrationBadge,
      })),
    [sortedEntries, hidden],
  );

  const missingPricedRows = useMemo(
    () =>
      missingPriced.map((entry) => ({
        holdingId: entry.holdingId,
        symbol: entry.symbol,
        name: entry.name,
        quantityLabel: formatQuantity(entry.quantity, entry.unit),
        updatePriceHref: entry.updatePriceHref,
      })),
    [missingPriced],
  );

  // Rỗng (131d) -> "chưa tính được" thay vì "0 ₫" (mẫu số NAV nhóm cổ phiếu
  // chưa xác định được, không phải bằng 0 theo nghĩa thường) — đúng ghi chú
  // Props gốc ở StockAllocationDetail.tsx.
  const groupNavLabel =
    rows.length === 0 ? "chưa tính được" : formatMoney(groupNav, { hidden });

  return (
    <StockAllocationDetail
      backHref={backHref}
      groupNavLabel={groupNavLabel}
      hidden={hidden}
      onToggleHidden={handleToggleHidden}
      sortLabel={SORT_LABEL[sortOrder]}
      onToggleSort={handleToggleSort}
      rows={rows}
      missingPricedRows={missingPricedRows}
    />
  );
}

export { StockAllocationDetailClient };
export type { StockAllocationDetailClientProps };
