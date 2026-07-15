"use client";

import { CheckCircle2, Lock, Snowflake } from "lucide-react";
import { useActionState } from "react";

import { Alert } from "@/components/Alert";
import {
  type AssetType,
  ASSET_TYPE_DOT_CLASS,
  ASSET_TYPE_LABEL,
} from "@/components/AssetTypeBadge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetPopup,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SnapshotTodayState } from "@/features/snapshots/types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type SnapshotFreezeBreakdownRow = { type: AssetType; value: string };

type SnapshotFreezeSheetProps = {
  navValue: string;
  cutoffDateLabel: string;
  breakdown: SnapshotFreezeBreakdownRow[]; // đúng 4 nhóm
  action: (
    prevState: SnapshotTodayState,
    formData: FormData,
  ) => Promise<SnapshotTodayState>;
  triggerClassName?: string;
};

// Bottom sheet "Chốt số liệu hôm nay" (mockup 3b) — client component tự chứa
// nút trigger + Sheet, mở từ màn Lịch sử NAV (3a). Cùng gọi 1 Server Action với
// SnapshotTodayCard (Dashboard) qua SnapshotTodayState dùng chung
// (@/features/snapshots/types) — không trùng lặp, chỉ khác nơi hiển thị.
function SnapshotFreezeSheet({
  navValue,
  cutoffDateLabel,
  breakdown,
  action,
  triggerClassName,
}: SnapshotFreezeSheetProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const isDone = state?.ok === true;

  return (
    <Sheet>
      <SheetTrigger
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/16 p-3.25 text-[13.5px] font-semibold text-primary",
          triggerClassName,
        )}
      >
        <Snowflake className="size-4.5" />
        Chốt số liệu hôm nay
      </SheetTrigger>

      <SheetPopup>
        <div className="flex items-center gap-2.75">
          <div className="flex size-10.5 shrink-0 items-center justify-center rounded-[30%] bg-primary/16">
            <Snowflake className="size-5.5 text-primary" />
          </div>
          <div>
            <div className="text-[16.5px] font-bold text-foreground">
              Chốt số liệu hôm nay
            </div>
            <div className="mt-0.25 text-[11.5px] text-muted-faint">
              Đóng băng NAV hiện tại làm mốc lịch sử
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-primary/30 bg-linear-to-br from-primary/16 to-card p-4.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              NAV sẽ đóng băng
            </span>
            <Badge className="text-[10px]">MANUAL</Badge>
          </div>
          <div className="font-mono text-[26px] font-semibold tracking-tight text-foreground">
            {formatMoney(navValue)}
          </div>
          <div className="mt-1.25 font-mono text-[11.5px] text-muted-faint">
            Mốc: {cutoffDateLabel} · dùng giá EOD gần nhất
          </div>
        </div>

        {!isDone ? (
          <>
            <div className="mt-3.5 overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
                Gồm snapshot tổng + {breakdown.length} nhóm
              </div>
              {breakdown.map((row) => (
                <div
                  key={row.type}
                  className="flex items-center gap-2.5 border-t border-white/4.5 px-3.75 py-2.5 first:border-t-0"
                >
                  <span
                    className={cn(
                      "size-2 rounded-sm",
                      ASSET_TYPE_DOT_CLASS[row.type],
                    )}
                  />
                  <span className="flex-1 text-[12.5px] text-muted-foreground">
                    {ASSET_TYPE_LABEL[row.type]}
                  </span>
                  <span className="font-mono text-[12.5px] font-semibold text-foreground">
                    {formatMoney(row.value, { compact: true })}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3.5 flex gap-2.25 rounded-xl border border-primary/20 bg-primary/8 p-3">
              <Lock className="mt-0.25 size-4.25 shrink-0 text-primary" />
              <div className="text-[11.5px] leading-relaxed text-muted-foreground">
                Sau khi chốt, số này{" "}
                <span className="text-foreground-soft">không đổi</span> dù giá
                cập nhật về sau — dùng cho báo cáo &amp; biểu đồ NAV.
              </div>
            </div>

            {state && !state.ok ? (
              <Alert
                variant="error"
                title="Không chốt được"
                description={state.error}
                className="mt-3.5"
              />
            ) : null}

            <form action={formAction} className="mt-4 flex gap-2.5">
              <SheetClose
                className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
              >
                Hủy
              </SheetClose>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-[2] gap-1.75"
              >
                <Snowflake className="size-4" />
                {isPending ? "Đang chốt…" : "Đóng băng số liệu"}
              </Button>
            </form>
          </>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3.5 py-2">
            <Badge variant="gain" className="text-[12px]">
              <CheckCircle2 />
              Đã chốt lúc {state.snapshotAt}
            </Badge>
            <SheetClose className={cn(buttonVariants(), "w-full")}>
              Đóng
            </SheetClose>
          </div>
        )}
      </SheetPopup>
    </Sheet>
  );
}

export { SnapshotFreezeSheet };
export type { SnapshotFreezeBreakdownRow, SnapshotFreezeSheetProps };
