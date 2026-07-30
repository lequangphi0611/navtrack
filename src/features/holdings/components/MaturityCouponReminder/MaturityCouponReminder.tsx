import { Plus, ReceiptText } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MaturityCouponReminderProps = {
  // "15/01/2029" — kỳ trả lãi trùng ngày đáo hạn.
  finalCouponDateLabel: string;
  // Link sang form ghi trái tức (DividendForm tab Trái tức).
  recordCouponHref: string;
  // Nút phụ "Đã ghi rồi" — ẩn lời nhắc. Vắng mặt = chỉ hiện nút chính.
  onDismiss?: () => void;
};

// Lời nhắc sau khi ghi tất toán đáo hạn thành công (mockup Phase 7 Screens 7e,
// khối "Sau khi ghi thành công · toast gợi ý"). Chỉ GỢI Ý — app không tự ghi
// trái tức kỳ cuối thay người dùng (cùng nguyên tắc "không tự ghi theo lịch" ở
// card suy lịch của 7a), vì tổ chức phát hành có thể trả lệch ngày/số tiền.
function MaturityCouponReminder({
  finalCouponDateLabel,
  recordCouponHref,
  onDismiss,
}: MaturityCouponReminderProps) {
  return (
    <div className="rounded-2xl border border-asset-bond/42 bg-linear-to-br from-asset-bond/18 to-card p-3.75">
      <div className="flex gap-2.75">
        <ReceiptText className="mt-px size-5 shrink-0 text-asset-bond" />
        <div className="flex-1">
          <div className="text-[13px] font-bold text-foreground">
            Bạn đã ghi trái tức kỳ cuối chưa?
          </div>
          <div className="mt-0.75 text-[11px] leading-relaxed text-muted-foreground">
            Kỳ {finalCouponDateLabel} thường được trả cùng lúc với gốc. App
            không tự ghi thay bạn.
          </div>
          <div className="mt-2.75 flex gap-2">
            <Link
              href={recordCouponHref}
              className={cn(
                buttonVariants(),
                "h-9 gap-1.5 rounded-xl text-xs font-bold",
              )}
            >
              <Plus className="size-3.75" />
              Ghi trái tức kỳ cuối
            </Link>
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-xl border border-border px-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
              >
                Đã ghi rồi
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export { MaturityCouponReminder };
export type { MaturityCouponReminderProps };
