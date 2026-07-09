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
        Danh mục đầu tư (nhập vị thế, giao dịch mua/bán) sẽ có ở bước tiếp theo
        của Phase 1 — xem <code className="font-mono">process/PROCESS.md</code>.
      </p>
      <Link
        href="/settings/members"
        className={cn(buttonVariants({ variant: "outline" }), "mt-2")}
      >
        Quản lý thành viên
      </Link>
    </div>
  );
}
