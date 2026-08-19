"use client";

import type { AssetType } from "@/components/AssetTypeBadge";
import { cn } from "@/lib/utils";

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "STOCK", label: "Cổ phiếu" },
  { value: "FUND", label: "Quỹ mở" },
  { value: "BOND", label: "Trái phiếu" },
  { value: "GOLD", label: "Vàng" },
];

type AssetTypeTilesProps = {
  value: AssetType;
  onChange: (value: AssetType) => void;
  disabled?: boolean;
};

// Lưới 4 ô chọn loại tài sản (mockup 2c) — khác SegmentedControl (thanh trượt).
// Dùng chung cho cả 2 nhánh "Đã có từ trước"/"Vừa mua hôm nay" của
// NewHoldingForm (issue #140) — tách ra đây để cả NewHoldingForm.tsx lẫn các
// field variant colocate cùng thư mục đều import lại được.
function AssetTypeTiles({ value, onChange, disabled }: AssetTypeTilesProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ASSET_TYPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-xl border px-1 py-2.5 text-xs font-semibold transition-colors",
            option.value === value
              ? "border-primary/40 bg-primary/14 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground-soft",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[12.5px] font-semibold text-muted-foreground">
      {children}
    </label>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 text-[11.5px] text-muted-faint">{children}</div>
  );
}

export { ASSET_TYPE_OPTIONS, AssetTypeTiles, FieldHint, FieldLabel };
export type { AssetTypeTilesProps };
