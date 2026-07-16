"use client";

import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  Coins,
  Plus,
  Snowflake,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

// Id thật của SnapshotTodayCard trên Dashboard — dùng để scrollIntoView khi
// bấm "Chốt số liệu hôm nay" (xem SnapshotTodayCard.tsx prop `id`).
const SNAPSHOT_TODAY_CARD_ID = "snapshot-today-card";

type QuickAction = {
  key: string;
  label: string;
  icon: typeof Plus;
  emphasized?: boolean;
} & (
  | { href: string; onClick?: undefined }
  | { href?: undefined; onClick: () => void }
);

type DashboardQuickMenuProps = {
  // true khi Container cấp `snapshotToday` (SnapshotTodayCard đang render trên
  // Dashboard, xem DashboardScreen.tsx) — quyết định có hiện hành động "Chốt
  // số liệu hôm nay" hay không. Vắng card thì không có gì để cuộn tới, ẩn hẳn
  // mục này khỏi menu (an toàn hơn hiện nút bấm không làm gì — xem
  // process/UI_phase_4.md).
  showSnapshotAction: boolean;
};

// FAB menu nhanh nổi góc dưới-phải Dashboard (mockup "Phase 4 Screens" 4f).
// State đóng/mở là UI thuần tuý (không điều hướng dữ liệu khác nhau giữa 2
// trạng thái) nên dùng useState tại chỗ, khác HoldingSwitcher/CutoffPicker
// (nơi đổi lựa chọn = đổi route/dữ liệu, bắt buộc qua Link).
function DashboardQuickMenu({ showSnapshotAction }: DashboardQuickMenuProps) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const actions: QuickAction[] = [
    {
      key: "trade",
      label: "Mua / Bán",
      icon: ArrowLeftRight,
      // Không có route "thêm giao dịch" độc lập (luôn cần holdingId, xem
      // lib/routes.ts) — trỏ tới danh sách vị thế để tự chọn mã rồi bấm "Thêm
      // giao dịch" từ HoldingDetailScreen. Lựa chọn ít giả định nhất, không
      // cần dựng thêm switcher mới chỉ cho FAB này.
      href: ROUTES.holdings,
    },
    {
      key: "new-holding",
      label: "Thêm vị thế",
      icon: ChartNoAxesCombined,
      href: ROUTES.newHolding,
    },
    {
      key: "dividend",
      label: "Cổ tức",
      icon: Coins,
      emphasized: true,
      href: ROUTES.newDividendStandalone,
    },
    ...(showSnapshotAction
      ? ([
          {
            key: "snapshot-today",
            label: "Chốt số liệu hôm nay",
            icon: Snowflake,
            onClick: () => {
              close();
              document
                .getElementById(SNAPSHOT_TODAY_CARD_ID)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            },
          } satisfies QuickAction,
        ] as QuickAction[])
      : []),
  ];

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Đóng menu nhanh"
          onClick={close}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        />
      ) : null}

      <div className="fixed right-5 bottom-37.5 z-50 flex flex-col items-end gap-2.75">
        {open
          ? actions
              .slice()
              .reverse()
              .map((action) => {
                const Icon = action.icon;
                const chip = (
                  <span
                    className={cn(
                      "rounded-lg border px-2.75 py-1.5 text-[12.5px] font-semibold shadow-lg",
                      action.emphasized
                        ? "border-accent/45 bg-accent/16 text-accent"
                        : "border-border bg-card-elevated text-foreground",
                    )}
                  >
                    {action.label}
                  </span>
                );
                const bubble = (
                  <span
                    className={cn(
                      "flex size-11.5 shrink-0 items-center justify-center rounded-[30%] border",
                      action.emphasized
                        ? "border-accent/50 bg-accent/18 text-accent"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5.5" />
                  </span>
                );

                return action.href ? (
                  <Link
                    key={action.key}
                    href={action.href}
                    onClick={close}
                    className="flex items-center gap-2.75 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
                  >
                    {chip}
                    {bubble}
                  </Link>
                ) : (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    className="flex items-center gap-2.75 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
                  >
                    {chip}
                    {bubble}
                  </button>
                );
              })
          : null}

        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Đóng menu nhanh" : "Mở menu nhanh"}
          onClick={() => setOpen((prev) => !prev)}
          className="flex size-14.5 items-center justify-center rounded-[30%] bg-accent text-accent-foreground shadow-xl shadow-accent/40 transition-[background-color,scale] hover:scale-105 active:scale-95"
        >
          {open ? <X className="size-7" /> : <Plus className="size-7" />}
        </button>
      </div>
    </>
  );
}

export { DashboardQuickMenu };
export type { DashboardQuickMenuProps };
