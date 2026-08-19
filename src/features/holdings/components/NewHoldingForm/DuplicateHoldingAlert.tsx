"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

type DuplicateHoldingAlertProps = {
  symbol: string;
  // existingQuantity/existingAvgCost đã format sẵn bởi cha (vd "8.000",
  // "92.400" — theo đúng mockup vtd, không phải Decimal thô) — component chỉ
  // ghép chuỗi, không tự gọi formatMoney (tự thêm "₫" ở cuối câu).
  existingQuantity: string;
  existingUnit: string;
  existingAvgCost: string;
  addTransactionHref: string;
  onSwitchToExisting: () => void;
};

// Khối lỗi trùng mã (issue #140, mockup vtd) — component riêng, KHÔNG mở
// rộng Alert (cấu trúc 2 tầng hành động khác title/description phẳng của
// Alert). CHƯA wiring vào NewHoldingForm — chưa có cơ chế phát hiện trùng mã
// thật (process/UI_new-holding-form-branches.md mục "Điểm cần xác nhận" #3),
// component này chỉ hiện thực lớp UI để business-implementer gắn vào sau.
function DuplicateHoldingAlert({
  symbol,
  existingQuantity,
  existingUnit,
  existingAvgCost,
  addTransactionHref,
  onSwitchToExisting,
}: DuplicateHoldingAlertProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-destructive/20 bg-destructive/9">
      <div className="flex items-start gap-2.5 p-3.5">
        <AlertTriangle className="mt-px size-4.5 shrink-0 text-destructive" />
        <div>
          <div className="text-sm font-semibold text-destructive">
            Bạn đã có vị thế {symbol} trong danh mục
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Đang giữ {existingQuantity} {existingUnit} · giá vốn{" "}
            {existingAvgCost} ₫
          </div>
        </div>
      </div>

      <div className="border-t border-destructive/15 bg-destructive/5 px-3.5 py-3">
        <Link
          href={addTransactionHref}
          className="flex h-11 w-full items-center justify-center rounded-[13px] bg-destructive text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Ghi giao dịch mua thêm {symbol} →
        </Link>
        <button
          type="button"
          onClick={onSwitchToExisting}
          className="mt-2.5 w-full text-center text-[11.5px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Hoặc đổi sang nhánh &quot;Đã có từ trước&quot; nếu đang khai báo vị
          thế cũ.
        </button>
      </div>
    </div>
  );
}

export { DuplicateHoldingAlert };
export type { DuplicateHoldingAlertProps };
