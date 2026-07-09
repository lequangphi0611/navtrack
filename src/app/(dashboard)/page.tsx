import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default async function DashboardHomePage() {
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-16 text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        Xin chào, {session?.user?.name ?? session?.user?.email}
      </h2>
      <p className="max-w-md text-muted-foreground">
        Theo dõi danh mục đầu tư của bạn — cổ phiếu, quỹ, trái phiếu, vàng.
      </p>
      <div className="mt-2 flex gap-2">
        <Link href="/holdings" className={cn(buttonVariants())}>
          Xem danh mục
        </Link>
        <Link
          href="/settings/members"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Quản lý thành viên
        </Link>
      </div>
    </div>
  );
}
