import { Plus, Wallet } from "lucide-react";
import Link from "next/link";

import { BottomNav } from "@/components/BottomNav";
import { buttonVariants } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type HoldingsEmptyStateProps = {
  displayName: string;
};

// Màn 2b (mockup): chưa có vị thế nào — kể cả đã đóng. Vẫn là route /holdings
// (nhánh rỗng) nên giữ BottomNav như HoldingsOverviewScreen (process/UI_phase_2.md).
function HoldingsEmptyState({ displayName }: HoldingsEmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col p-5 pb-28 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-medium text-muted-foreground">
            Chào,
          </div>
          <div className="text-lg font-semibold tracking-tight text-foreground">
            {displayName}
          </div>
        </div>
        <Link href={ROUTES.settings} aria-label="Cài đặt">
          <UserAvatar name={displayName} />
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center pb-16">
        <div className="flex size-16 items-center justify-center rounded-[30%] bg-primary/12">
          <Wallet className="size-8 text-primary" />
        </div>
        <div className="mt-5 text-lg font-semibold text-foreground">
          Chưa có vị thế nào
        </div>
        <p className="mt-2 max-w-70 text-center text-[13.5px] leading-relaxed text-muted-foreground">
          Khai báo những gì bạn đang giữ hôm nay — cổ phiếu, quỹ, trái phiếu,
          vàng — để bắt đầu theo dõi từ đây.
        </p>
        <Link
          href={ROUTES.newHolding}
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-5.5 h-12 gap-2 rounded-[14px] px-5.5 text-[14.5px] font-semibold",
          )}
        >
          <Plus className="size-4.5" />
          Khai báo vị thế đầu tiên
        </Link>
      </div>

      <BottomNav active="holdings" />
    </div>
  );
}

export { HoldingsEmptyState };
export type { HoldingsEmptyStateProps };
