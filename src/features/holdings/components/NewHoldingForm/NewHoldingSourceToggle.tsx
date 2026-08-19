"use client";

import { Archive, ShoppingCart } from "lucide-react";

import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/SegmentedControl";

// State UI thuần — KHÔNG phải cột DB mới, mỗi lần submit vẫn chỉ ghi
// Cashflow{BUY} như cũ. "Nguồn" chỉ quyết định field nào hiển thị + có card
// phí hay không (process/UI_new-holding-form-branches.md mục vta).
type PositionSource = "EXISTING" | "NEW_PURCHASE";

type NewHoldingSourceToggleProps = {
  value: PositionSource;
  onChange: (value: PositionSource) => void;
  disabled?: boolean;
};

const OPTIONS: SegmentedControlOption<PositionSource>[] = [
  {
    value: "EXISTING",
    label: "Đã có từ trước",
    icon: Archive,
    activeClassName: "text-primary-foreground",
  },
  {
    value: "NEW_PURCHASE",
    label: "Vừa mua hôm nay",
    icon: ShoppingCart,
    activeClassName: "text-primary-foreground",
  },
];

const CAPTION: Record<PositionSource, string> = {
  EXISTING:
    "Khai báo một vị thế đang giữ sẵn — gõ giá vốn bình quân đã gộp nhiều lần mua trước đây.",
  NEW_PURCHASE:
    "Ghi một lệnh mua thật cho mã chưa có trong danh mục — phí giao dịch tự tính vào giá vốn.",
};

// Bộ chọn nhánh đầu NewHoldingForm (issue #140, mockup vta) — đứng ngay trên
// field "Loại tài sản". Dùng SegmentedControl sẵn có, thanh trượt màu primary
// (khác cặp Mua/Bán ở TransactionForm dùng gain/destructive vì đây không phải
// cặp đối lập lãi/lỗ).
function NewHoldingSourceToggle({
  value,
  onChange,
  disabled,
}: NewHoldingSourceToggleProps) {
  return (
    <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
      <SegmentedControl
        options={OPTIONS}
        value={value}
        onChange={onChange}
        thumbClassName="bg-primary"
        stretch
      />
      <div className="mt-2 text-[11.5px] text-muted-faint">
        {CAPTION[value]}
      </div>
    </div>
  );
}

export { NewHoldingSourceToggle };
export type { NewHoldingSourceToggleProps, PositionSource };
