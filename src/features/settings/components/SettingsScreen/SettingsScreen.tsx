import { History, LogOut, Users } from "lucide-react";

import { BottomNav } from "@/components/BottomNav";
import { PageHeader } from "@/components/PageHeader";
import { SettingsMenuItem } from "@/components/SettingsMenuItem";
import {
  CutoffPicker,
  type CutoffPickerProps,
} from "@/features/settings/components/CutoffPicker";
import { ROUTES } from "@/lib/routes";

type SettingsScreenProps = {
  // Optional: business-implementer chưa có nơi tính/lưu mốc chốt (TBD, xem
  // process/UI_phase_2.md) — vắng mặt thì ẩn hẳn khối "Mốc chốt định giá",
  // giữ nguyên hành vi Phase 1 (chỉ Thành viên + Đăng xuất) + BottomNav mới.
  cutoff?: CutoffPickerProps;
  // Form action đăng xuất — giữ nguyên cách wiring của page.tsx gốc
  // (`"use server"` inline gọi signOut()), chỉ đổi chỗ render.
  onSignOut: () => Promise<void>;
};

// Organism cho /settings — extract từ page.tsx (Phase 1 inline JSX) + thêm mục
// "Mốc chốt định giá" (mockup 2e). Giữ nguyên logic đăng xuất/link thành viên.
function SettingsScreen({ cutoff, onSignOut }: SettingsScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 pb-28 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title="Cài đặt" backHref={ROUTES.holdings} />

      <div className="flex flex-col gap-2">
        <SettingsMenuItem
          href={ROUTES.members}
          icon={Users}
          label="Thành viên"
        />
        <SettingsMenuItem
          href={ROUTES.snapshotSchedule}
          icon={History}
          label="Lịch chốt tự động"
        />

        {cutoff ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">
                  Mốc chốt định giá
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-faint">
                  Áp dụng cho toàn bộ NAV &amp; XIRR
                </div>
              </div>
            </div>
            <CutoffPicker {...cutoff} />
            <div className="mt-3 text-[11px] leading-relaxed text-muted-faint">
              Đổi mốc chốt → NAV giả định &amp; XIRR ở Tổng quan tính lại theo
              giá tại mốc đó.
            </div>
          </div>
        ) : null}

        <form action={onSignOut} className="mt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-5 text-destructive" />
            <span className="flex-1 text-sm font-semibold text-destructive">
              Đăng xuất
            </span>
          </button>
        </form>
      </div>

      <BottomNav active="settings" />
    </div>
  );
}

export { SettingsScreen };
export type { SettingsScreenProps };
