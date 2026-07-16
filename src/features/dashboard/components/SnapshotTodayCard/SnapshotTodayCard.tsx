"use client";

import { CheckCircle2, Snowflake } from "lucide-react";
import { useActionState } from "react";

import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SnapshotTodayState } from "@/features/snapshots/types";

type SnapshotTodayCardProps = {
  // Server xác nhận đã có Snapshot{period: MANUAL} hôm nay — độc lập với
  // client state, giữ đúng ngay cả khi user chưa submit form trong phiên này
  // (vd tải lại trang sau khi đã chốt trước đó).
  alreadySnapshotToday: boolean;
  // "09:14" — có mặt khi alreadySnapshotToday = true.
  snapshotTakenAt?: string;
  action: (
    prevState: SnapshotTodayState,
    formData: FormData,
  ) => Promise<SnapshotTodayState>;
  className?: string;
  // DOM id — cho phép target `scrollIntoView` từ nơi khác (Phase 4,
  // `DashboardQuickMenu` cuộn tới card này khi bấm "Chốt số liệu hôm nay").
  id?: string;
};

// Card CTA "Chốt số liệu hôm nay" (mockup 3b, rút gọn) — Dashboard, không phải
// Settings (gắn trực tiếp với NAV "hôm nay" đang hiển thị ngay phía trên).
// Gộp chung nhánh render "đã chốt hôm nay rồi" (server truth) và "success"
// (vừa submit xong) vì cùng một hình dạng hiển thị, chỉ khác nguồn giờ.
function SnapshotTodayCard({
  alreadySnapshotToday,
  snapshotTakenAt,
  action,
  className,
  id,
}: SnapshotTodayCardProps) {
  const [state, formAction, isPending] = useActionState(action, null);

  const isDone = alreadySnapshotToday || state?.ok === true;
  const takenAt = state?.ok ? state.snapshotAt : snapshotTakenAt;

  return (
    <div
      id={id}
      className={cn("rounded-2xl border border-border bg-card p-4", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-semibold text-foreground">
            Chốt số liệu hôm nay
          </div>
          <div className="mt-1 text-[11.5px] leading-relaxed text-muted-faint">
            Đóng băng NAV hiện tại làm mốc lịch sử — không đổi dù giá cập nhật
            về sau.
          </div>
        </div>
        {isDone ? (
          <Badge variant="gain" className="shrink-0">
            <CheckCircle2 />
            Đã chốt lúc {takenAt}
          </Badge>
        ) : null}
      </div>

      {!isDone ? (
        <form action={formAction} className="mt-3.5">
          <Button type="submit" disabled={isPending} className="w-full">
            <Snowflake className="size-4" />
            {isPending ? "Đang chốt…" : "Chốt ngay"}
          </Button>
        </form>
      ) : null}

      {state && !state.ok ? (
        <Alert
          variant="error"
          title="Không chốt được"
          description={state.error}
          className="mt-3.5"
        />
      ) : null}
    </div>
  );
}

export { SnapshotTodayCard };
export type { SnapshotTodayCardProps, SnapshotTodayState };
