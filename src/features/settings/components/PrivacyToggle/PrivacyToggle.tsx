"use client";

import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { Switch } from "@/components/ui/switch";
import { setHideAmountsByDefault } from "@/features/settings/actions";
import { cn } from "@/lib/utils";

type PrivacyToggleProps = {
  // Đọc từ User.hideAmountsByDefault (server) — cùng nguồn với nút mắt header
  // Dashboard (mục 8/11 phase-6.md), KHÔNG có tầng "override phiên" riêng.
  initialHidden: boolean;
  className?: string;
};

// Card "Chế độ ẩn số tiền" trong nhóm "Riêng tư" (mockup 6f) — icon tròn đổi
// theo trạng thái (cùng tint eye button header) + label + mô tả + Switch mới.
// Ghi optimistic ngay + gọi Server Action trong startTransition — CÙNG một
// giá trị `User.hideAmountsByDefault` với nút mắt header (process/DECISION.md
// 2026-07-21 mục (1)), không cần đồng bộ 2 chiều realtime (mỗi route tự đọc
// lại DB khi điều hướng).
function PrivacyToggle({ initialHidden, className }: PrivacyToggleProps) {
  const [hidden, setHidden] = useState(initialHidden);
  const [, startTransition] = useTransition();

  const handleCheckedChange = (checked: boolean) => {
    const previous = hidden;
    setHidden(checked);
    startTransition(() => {
      // Ghi thất bại (chưa đăng nhập/DB lỗi) -> quay lại giá trị TRƯỚC đó thay
      // vì để UI đứng yên ở trạng thái optimistic chưa lưu được — trước đây
      // fire-and-forget, chỉ lộ ra khi user load lại trang thấy "nhảy" về giá
      // trị cũ (code review #14).
      void setHideAmountsByDefault(checked)
        .then((result) => {
          if (!result.ok) setHidden(previous);
        })
        .catch(() => {
          setHidden(previous);
        });
    });
  };

  const Icon = hidden ? EyeOff : Eye;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            hidden
              ? "bg-primary/16 text-primary"
              : "bg-white/5 text-muted-foreground",
          )}
        >
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            Chế độ ẩn số tiền
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted-faint">
            Che mọi số tiền VND tuyệt đối · giữ % &amp; XIRR
          </div>
        </div>
        <Switch
          checked={hidden}
          onCheckedChange={handleCheckedChange}
          aria-label="Chế độ ẩn số tiền"
        />
      </div>
      <div className="flex items-start gap-2 text-[10.5px] leading-relaxed text-muted-faint">
        <RefreshCw className="mt-0.25 size-3 shrink-0" />
        <span>
          Cùng một trạng thái với nút mắt ở header Tổng quan — bật ở đâu cũng áp
          cho cả hai. Hiện đang{" "}
          <span className="font-semibold text-muted-foreground">
            {hidden ? "ẩn" : "hiện"}
          </span>
          .
        </span>
      </div>
    </div>
  );
}

export { PrivacyToggle };
export type { PrivacyToggleProps };
