import { CalendarCheck2, CalendarRange, Clock, Info, Lock } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";

type SnapshotScheduleScreenProps = { backHref: string }; // ROUTES.settings

// Organism cho /settings/snapshot-schedule (mockup 3e) — nội dung TĨNH, không
// query: lịch chốt tự động cố định trong .github/workflows/snapshot-cron.yml,
// app chỉ hiển thị. Cron thật (đã xác nhận từ file workflow) là MỘT dòng
// "0 0 1 * *" duy nhất — SỬA so với mockup vẽ 2 dòng cron riêng cho tháng/năm
// (workflow chỉ chạy 1 lần/tháng, luôn ghi PERIODIC, riêng tháng 1 ghi thêm
// YEAR_END — không phải 2 lịch khác nhau). Drill-down subpage của Cài đặt,
// KHÔNG có BottomNav (đúng tiền lệ /settings/members).
function SnapshotScheduleScreen({ backHref }: SnapshotScheduleScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Lịch chốt tự động"
        backHref={backHref}
        trailing={
          <Badge variant="neutral" className="gap-1 text-[10.5px]">
            <Lock />
            Chỉ xem
          </Badge>
        }
      />

      <p className="text-xs leading-relaxed text-muted-faint">
        Tần suất snapshot định kỳ được{" "}
        <span className="text-foreground-soft">
          cố định trong GitHub Actions workflow
        </span>
        , không chỉnh trong app. Mốc &quot;hôm nay&quot; luôn tính động, không
        lưu.
      </p>

      <div className="flex flex-col gap-2.25">
        <div className="flex items-center gap-2.75 rounded-2xl border border-primary/40 bg-primary/12 p-3.5">
          <CalendarRange className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">
              Hàng tháng
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-muted-faint">
              Ngày 01 chốt cho cuối tháng trước
            </div>
          </div>
          <Badge className="shrink-0 text-[9.5px]">ĐANG ÁP DỤNG</Badge>
        </div>

        <div className="flex items-center gap-2.75 rounded-2xl border border-accent/24 bg-accent/7 p-3.5">
          <CalendarCheck2 className="size-5 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">
              Chốt cuối năm
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-muted-faint">
              01/01 ghi YEAR_END cho 31/12
            </div>
          </div>
          <Badge variant="accent" className="shrink-0 text-[9.5px]">
            ĐANG ÁP DỤNG
          </Badge>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-1.75 border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
          <Clock className="size-3.75 text-muted-faint" />
          Lịch cron trong workflow
        </div>
        <div className="flex items-center gap-2.5 px-3.75 py-2.75">
          <CalendarRange className="size-3.75 text-primary" />
          <span className="flex-1 text-xs text-muted-foreground">
            Ngày 01 hằng tháng — luôn ghi PERIODIC, riêng tháng 1 ghi thêm
            YEAR_END
          </span>
          <span className="font-mono text-[11.5px] text-foreground">
            0 0 1 * *
          </span>
        </div>
      </div>

      <div className="flex gap-2.5 rounded-xl border border-border bg-card p-3.25">
        <Info className="mt-0.5 size-4.25 shrink-0 text-muted-faint" />
        <p className="text-[11px] leading-relaxed text-muted-faint">
          Muốn đổi tần suất? Sửa cron trong{" "}
          <span className="font-mono text-muted-foreground">
            .github/workflows
          </span>{" "}
          — app chỉ hiển thị lịch đang chạy.
        </p>
      </div>
    </div>
  );
}

export { SnapshotScheduleScreen };
export type { SnapshotScheduleScreenProps };
