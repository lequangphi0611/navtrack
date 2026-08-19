"use client";

import {
  ASSET_TYPE_DOT_CLASS,
  ASSET_TYPE_LABEL,
  ASSET_TYPE_TINT_CLASS,
  type AssetType,
} from "@/components/AssetTypeBadge";
import { cn } from "@/lib/utils";

import type { AssetTypeFilter, AssetTypeFilterOption } from "./types";

type AssetTypeFilterChipsProps = {
  filters: AssetTypeFilterOption[];
  value: AssetTypeFilter;
  onChange: (type: AssetTypeFilter) => void;
  className?: string;
};

// Border màu theo loại khi chip active — dùng utility `border-asset-*/opacity`
// TƯỜNG MINH (đã có tiền lệ `border-warning/28`, `border-primary/22` khắp
// codebase) thay vì `border-current/opacity` (chưa có tiền lệ nào dùng, không
// chắc color-mix hoạt động đúng với từ khoá `currentColor` trong Tailwind v4).
const ASSET_TYPE_ACTIVE_BORDER_CLASS: Record<AssetType, string> = {
  STOCK: "border-asset-stock/40",
  FUND: "border-asset-fund/40",
  BOND: "border-asset-bond/45",
  GOLD: "border-asset-gold/45",
};

// Chip cuộn ngang cho bộ lọc loại tài sản (mockup 139a-e) — KHÁC SegmentedControl
// (số lựa chọn cố định, không cuộn ngang) nên không tái dùng được, xem digest
// process/UI_nav-trend-by-asset-type.md mục "Atom/molecule dùng lại". Colocate
// trong NavTrendByAssetType/ (chỉ 1 chỗ dùng), không promote lên components/.
// Client leaf tách riêng (mirror SortToggleButton) dù cha (NavTrendByAssetTypeChart)
// đã "use client" — giữ nhất quán quy ước "leaf tương tác luôn tự khai use client".
function AssetTypeFilterChips({
  filters,
  value,
  onChange,
  className,
}: AssetTypeFilterChipsProps) {
  return (
    <div className={cn("flex gap-1.75 overflow-x-auto pb-0.5", className)}>
      {filters.map((filter) => {
        const isActive = filter.type === value;
        const label =
          filter.type === "ALL" ? "Tất cả" : ASSET_TYPE_LABEL[filter.type];

        return (
          <button
            key={filter.type}
            type="button"
            onClick={() => onChange(filter.type)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.75 text-[12.5px] font-semibold transition-colors",
              isActive
                ? filter.type === "ALL"
                  ? "border-primary/40 bg-primary/16 text-primary"
                  : cn(
                      ASSET_TYPE_ACTIVE_BORDER_CLASS[filter.type],
                      ASSET_TYPE_TINT_CLASS[filter.type],
                    )
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {filter.type !== "ALL" ? (
              <span
                className={cn(
                  "size-1.75 rounded-sm",
                  ASSET_TYPE_DOT_CLASS[filter.type],
                )}
              />
            ) : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export { AssetTypeFilterChips };
export type { AssetTypeFilterChipsProps };
