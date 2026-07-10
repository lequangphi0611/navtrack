import { Archive, Plus, Wallet } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { UserAvatar } from "@/components/UserAvatar";
import { HoldingsList } from "@/features/holdings/components/HoldingsList";
import { HoldingsTabs } from "@/features/holdings/components/HoldingsTabs";
import { ROUTES } from "@/lib/routes";

import type { HoldingSummary } from "../../types";

type HoldingsOverviewScreenProps = {
  displayName: string;
  open: HoldingSummary[];
  closed: HoldingSummary[];
  totalInvested: string;
};

// Màn 2d (mockup): tổng vốn + tab Đang mở/Đã đóng + FAB.
function HoldingsOverviewScreen({
  displayName,
  open,
  closed,
  totalInvested,
}: HoldingsOverviewScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Danh mục
        </h1>
        <Link href={ROUTES.settings} aria-label="Cài đặt">
          <UserAvatar name={displayName} />
        </Link>
      </div>

      <StatCard
        label="Tổng vốn đã bỏ vào"
        value={totalInvested}
        note="Chưa có giá thị trường — lãi/lỗ & XIRR sẽ có ở bản sau."
      />

      <HoldingsTabs
        openContent={
          open.length > 0 ? (
            <HoldingsList holdings={open} />
          ) : (
            <EmptyState
              icon={Wallet}
              title="Chưa có vị thế nào đang mở"
              description="Thêm giao dịch mua để mở lại vị thế."
            />
          )
        }
        closedContent={
          closed.length > 0 ? (
            <HoldingsList holdings={closed} />
          ) : (
            <EmptyState
              icon={Archive}
              title="Chưa có vị thế nào đã đóng"
              description="Vị thế đóng khi bạn bán hết số lượng đang giữ."
            />
          )
        }
      />

      <Link
        href={ROUTES.newHolding}
        aria-label="Khai báo vị thế mới"
        className="sticky bottom-6 z-10 mt-auto flex size-14 items-center justify-center self-end rounded-[30%] bg-primary text-primary-foreground shadow-xl shadow-primary/40 transition-[background-color,scale] hover:scale-105 hover:bg-primary/90 active:scale-95"
      >
        <Plus className="size-6.5" />
      </Link>
    </div>
  );
}

export { HoldingsOverviewScreen };
export type { HoldingsOverviewScreenProps };
