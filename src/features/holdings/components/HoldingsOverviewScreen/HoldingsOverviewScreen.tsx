import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { BottomNav } from "@/components/BottomNav";
import { StatCardSkeleton } from "@/components/StatCard";
import { UserAvatar } from "@/components/UserAvatar";
import { HoldingsSegmentedNav } from "@/features/holdings/components/HoldingsSegmentedNav";
import { TotalInvestedSection } from "@/features/holdings/components/TotalInvestedSection";
import { ROUTES } from "@/lib/routes";

type HoldingsOverviewScreenProps = {
  displayName: string;
  children: React.ReactNode;
};

// Shell dùng chung cho /holdings + /holdings/closed (khai báo ở layout.tsx của route
// group (overview)): header + StatCard tổng vốn (vùng data riêng) + segmented nav
// (điều hướng route, không phải tab client) + FAB + BottomNav (mockup Phase 2 —
// áp ngược cho màn gốc Phase 1, xem process/UI_phase_2.md). Danh sách vị thế của
// route con nào truyền vào qua children, tự lo Suspense/skeleton riêng của nó.
function HoldingsOverviewScreen({
  displayName,
  children,
}: HoldingsOverviewScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 pb-28 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Danh mục
        </h1>
        <Link href={ROUTES.settings} aria-label="Cài đặt">
          <UserAvatar name={displayName} />
        </Link>
      </div>

      <Suspense fallback={<StatCardSkeleton />}>
        <TotalInvestedSection />
      </Suspense>

      <HoldingsSegmentedNav />

      {children}

      {/* bottom-24 (thay bottom-6 Phase 1) để nổi trên BottomNav cố định đáy màn hình. */}
      <Link
        href={ROUTES.newHolding}
        aria-label="Khai báo vị thế mới"
        className="sticky bottom-24 z-10 mt-auto flex size-14 items-center justify-center self-end rounded-[30%] bg-primary text-primary-foreground shadow-xl shadow-primary/40 transition-[background-color,scale] hover:scale-105 hover:bg-primary/90 active:scale-95"
      >
        <Plus className="size-6.5" />
      </Link>

      <BottomNav active="holdings" />
    </div>
  );
}

export { HoldingsOverviewScreen };
export type { HoldingsOverviewScreenProps };
