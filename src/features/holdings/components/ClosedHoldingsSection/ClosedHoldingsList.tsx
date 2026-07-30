"use client";

import { useState } from "react";

import {
  ClosedHoldingRow,
  type ClosedHoldingRowData,
} from "@/features/holdings/components/ClosedHoldingRow";
import {
  ClosedPositionSheet,
  type ClosedPositionSheetProps,
} from "@/features/holdings/components/ClosedPositionSheet";

type ClosedHoldingWithSheetData = ClosedHoldingRowData & {
  startMonthLabel: string;
  endMonthLabel: string;
  totalInvested: string;
  totalProceeds: string;
  totalDividends: string;
  orders: ClosedPositionSheetProps["orders"];
  reopenHref: string;
  detailHref: string;
};

type ClosedHoldingsListProps = {
  rows: ClosedHoldingWithSheetData[];
  hidden?: boolean;
};

// Danh sách vị thế đã đóng (mockup 6g) + Sheet chi tiết (6i) — state `selectedId`
// giữ Ở ĐÂY (client), KHÔNG phải route riêng (mirror TransactionHoldingPicker).
// Component cha (ClosedHoldingsSection, Server) đã gộp sẵn dữ liệu timeline/vốn
// mua-bán cho MỌI dòng — sheet chỉ tra cứu lại theo id, không tự fetch.
function ClosedHoldingsList({ rows, hidden = false }: ClosedHoldingsListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <ClosedHoldingRow
          key={row.id}
          holding={row}
          hidden={hidden}
          onSelect={() => setSelectedId(row.id)}
        />
      ))}

      {selected ? (
        <ClosedPositionSheet
          open={selectedId !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          // Props gộp theo vùng (issue #110) — `selected` (ClosedHoldingWithSheetData)
          // vẫn giữ shape phẳng, truyền thẳng cho từng nhóm nhờ structural typing
          // (đủ field cần, dư field không lỗi) thay vì liệt kê tay 15 field.
          identity={selected}
          pnl={selected}
          holdingPeriod={selected}
          breakdown={selected}
          orders={selected.orders}
          actions={selected}
          hidden={hidden}
        />
      ) : null}
    </div>
  );
}

export { ClosedHoldingsList };
export type { ClosedHoldingWithSheetData, ClosedHoldingsListProps };
