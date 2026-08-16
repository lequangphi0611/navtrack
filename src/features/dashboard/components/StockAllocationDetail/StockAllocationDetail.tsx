import { Ban, CircleDollarSign, Info } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { MoneyValueToggleButton } from "@/components/MoneyValue";
import { PageHeader } from "@/components/PageHeader";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

import { InfoCallout } from "./InfoCallout";
import { SortToggleButton } from "./SortToggleButton";
import {
  StockAllocationRow,
  type StockAllocationRowData,
} from "./StockAllocationRow";

// Mã cổ phiếu đang giữ nhưng thiếu giá — loại khỏi mẫu số NAV nhóm cổ phiếu
// hoàn toàn (KHÔNG mặc định 0%), xem "Bối cảnh nghiệp vụ bắt buộc" ở
// process/UI_stock-allocation-detail.md.
type MissingPricedStockRow = {
  holdingId: string;
  symbol: string;
  name: string;
  // Đã format qua formatQuantity(), vd "1.200 CP".
  quantityLabel: string;
  // ROUTES.navOverrideNew(holdingId) — route sửa giá tay đã có.
  updatePriceHref: string;
};

type StockAllocationDetailProps = {
  backHref: string;
  // "404.000.000 ₫" | "••••••" (hidden) | "chưa tính được" (rows rỗng, xem
  // mockup 131d) — string ĐÃ format sẵn, component không tự formatMoney (mẫu
  // số rỗng cần hiện "chưa tính được" thay vì "0 ₫", một helper chung không
  // biểu đạt được — việc format thuộc container, xem digest).
  groupNavLabel: string;
  hidden?: boolean;
  // Có mặt = header hiện nút mắt. Vắng mặt = ẩn nút (mirror DashboardScreen).
  onToggleHidden?: () => void;
  // "% giảm dần" | "Theo mã A→Z" — container tự format, component không biết
  // enum sort, chỉ hiển thị nhãn hiện tại + gọi callback khi bấm.
  sortLabel: string;
  onToggleSort?: () => void;
  // Mã ĐÃ có giá, đã sort sẵn theo sortLabel hiện tại — component KHÔNG tự sort.
  rows: StockAllocationRowData[];
  // [] = không hiện khu vực "Không tính vào tỉ trọng" (131a/131c).
  missingPricedRows: MissingPricedStockRow[];
};

// Một dòng trong khu vực "mã thiếu giá" — dùng chung cho cả biến thể rỗng
// (131d, mọi mã đều thiếu giá) lẫn biến thể có tỉ trọng kèm mã thiếu giá riêng
// (131b) — hai ngữ cảnh khác nhau về kích thước/CTA nên tách qua `compact`.
function MissingPricedRowItem({
  row,
  compact,
}: {
  row: MissingPricedStockRow;
  compact: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-warning/28 bg-warning/5 p-3.25">
        <SymbolAvatar
          symbol={row.symbol}
          size="sm"
          colorClassName="bg-warning/13 text-warning"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-foreground">
              {row.symbol}
            </span>
            <Badge variant="warning">Thiếu giá</Badge>
          </div>
          <div className="mt-0.5 font-mono text-[11.5px] text-muted-faint tabular-nums">
            {row.quantityLabel}
          </div>
        </div>
        <span className="font-mono text-[15px] font-semibold text-muted-faint">
          —
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-warning/32 bg-warning/5 p-3.5">
      <div className="flex items-center gap-3">
        <SymbolAvatar
          symbol={row.symbol}
          colorClassName="bg-warning/13 text-warning"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">
              {row.symbol}
            </span>
            <span className="truncate text-xs text-muted-faint">
              {row.name}
            </span>
            <Badge variant="warning">Thiếu giá</Badge>
          </div>
          <div className="mt-0.75 font-mono text-xs text-muted-faint tabular-nums">
            {row.quantityLabel}
          </div>
        </div>
        <div className="pl-1.5 text-right">
          <div className="font-mono text-lg font-semibold text-muted-faint">
            —
          </div>
          <div className="mt-0.25 text-[9.5px] font-semibold text-muted-faint">
            chưa tính được
          </div>
        </div>
      </div>
      <Link
        href={row.updatePriceHref}
        className={cn(
          buttonVariants({ size: "sm" }),
          "mt-3 w-full rounded-full bg-warning/14 text-warning hover:bg-warning/22",
        )}
      >
        Cập nhật giá
      </Link>
    </div>
  );
}

// Drill-down "% theo mã trong nhóm cổ phiếu" từ /allocation (issue #131, mockup
// 131a-d) — mẫu số KHÁC ConcentrationBadge (mẫu số = NAV toàn danh mục): ở đây
// mẫu số là NAV NHÓM CỔ PHIẾU. Hai con số % khác mẫu số cùng tồn tại trên một
// dòng (số lớn cột phải = mới, badge amber cạnh tên = cũ) — KHÔNG BAO GIỜ hiện
// % trần không kèm ngữ cảnh mẫu số (process/UI_stock-allocation-detail.md).
//
// 4 biến thể dữ liệu (131a-d) dùng CHUNG component này (không phải biến thiên
// theo enum nghiệp vụ) — rẽ nhánh theo shape của rows/missingPricedRows, cùng
// tiền lệ AllocationScreen.tsx (rẽ nhánh slices.length === 0 ngay trong cùng
// component).
function StockAllocationDetail({
  backHref,
  groupNavLabel,
  hidden = false,
  onToggleHidden,
  sortLabel,
  onToggleSort,
  rows,
  missingPricedRows,
}: StockAllocationDetailProps) {
  const isEmpty = rows.length === 0;
  const totalPercent = rows.reduce((sum, row) => sum + row.percent, 0);
  const soleRow = rows.length === 1 ? rows[0] : undefined;
  const singleMissingPricedRow =
    missingPricedRows.length === 1 ? missingPricedRows[0] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 pb-10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        variant="back"
        backHref={backHref}
        title="Cổ phiếu"
        subtitle={`% trong nhóm cổ phiếu · NAV nhóm ${groupNavLabel}`}
        trailing={
          onToggleHidden ? (
            <MoneyValueToggleButton
              hidden={hidden}
              onToggleHidden={onToggleHidden}
            />
          ) : undefined
        }
      />

      {isEmpty ? (
        <>
          <EmptyState
            icon={CircleDollarSign}
            title="Chưa tính được tỉ trọng"
            description={
              missingPricedRows.length > 0
                ? `Cả ${missingPricedRows.length} mã cổ phiếu bạn đang giữ đều chưa có giá, nên NAV nhóm cổ phiếu chưa xác định. Cập nhật giá để xem tỉ trọng từng mã.`
                : "Bạn chưa có mã cổ phiếu nào trong danh mục."
            }
            action={
              singleMissingPricedRow ? (
                <Link
                  href={singleMissingPricedRow.updatePriceHref}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "rounded-full px-4",
                  )}
                >
                  Cập nhật giá
                </Link>
              ) : undefined
            }
          />

          {missingPricedRows.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <div className="text-[10.5px] font-semibold tracking-wide text-muted-faint uppercase">
                Mã đang giữ · chưa định giá
              </div>
              {missingPricedRows.map((row) => (
                <MissingPricedRowItem key={row.holdingId} row={row} compact />
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {missingPricedRows.length > 0
                ? `Có tỉ trọng · ${rows.length} mã`
                : `${rows.length} mã có giá · mẫu số ${groupNavLabel}`}
            </span>
            {rows.length > 1 ? (
              <SortToggleButton
                sortLabel={sortLabel}
                onToggleSort={onToggleSort}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <StockAllocationRow key={row.holdingId} {...row} />
            ))}
          </div>

          {soleRow ? (
            <InfoCallout
              icon={Info}
              iconClassName="text-primary"
              containerClassName="border-primary/22 bg-primary/7"
            >
              Chỉ có 1 mã cổ phiếu trong danh mục nên chiếm trọn 100% nhóm —
              không phải lỗi hiển thị.
              {soleRow.concentrationBadge &&
              "percent" in soleRow.concentrationBadge ? (
                <>
                  {" "}
                  Toàn danh mục:{" "}
                  <span className="font-semibold text-foreground">
                    {formatPercent(soleRow.concentrationBadge.percent)}
                  </span>
                  .
                </>
              ) : null}
            </InfoCallout>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl border border-asset-stock/22 bg-asset-stock/7 p-3.75">
            <span className="text-[12px] font-semibold text-asset-stock">
              Tổng nhóm cổ phiếu
            </span>
            <div className="text-right">
              <div className="font-mono text-sm font-semibold text-asset-stock tabular-nums">
                {formatPercent(totalPercent)}
              </div>
              <div className="mt-0.25 font-mono text-[11px] text-muted-foreground tabular-nums">
                {groupNavLabel}
              </div>
            </div>
          </div>

          {missingPricedRows.length > 0 ? (
            <>
              <div className="my-1 flex items-center gap-2.5">
                <span className="h-px flex-1 bg-white/7" />
                <span className="flex items-center gap-1 text-[10.5px] font-semibold tracking-wide text-muted-faint uppercase">
                  <Ban className="size-3" />
                  Không tính vào tỉ trọng
                </span>
                <span className="h-px flex-1 bg-white/7" />
              </div>
              <div className="flex flex-col gap-2.5">
                {missingPricedRows.map((row) => (
                  <MissingPricedRowItem
                    key={row.holdingId}
                    row={row}
                    compact={false}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export { StockAllocationDetail };
export type {
  StockAllocationDetailProps,
  StockAllocationRowData,
  MissingPricedStockRow,
};
