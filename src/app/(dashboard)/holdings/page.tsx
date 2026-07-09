import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { HoldingRow } from "@/features/holdings/components/HoldingRow";
import { getOpenHoldings } from "@/features/holdings/queries";
import { cn } from "@/lib/utils";

export default async function HoldingsPage() {
  const holdings = await getOpenHoldings();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Danh mục
        </h1>
        <Link
          href="/holdings/new"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Thêm mã mới
        </Link>
      </div>

      {holdings.length === 0 ? (
        <EmptyState
          title="Chưa có vị thế nào"
          description="Nhập vị thế đang giữ để bắt đầu theo dõi danh mục."
          action={
            <Link
              href="/holdings/new"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Nhập vị thế đầu tiên
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {holdings.map((holding) => (
            <HoldingRow key={holding.id} holding={holding} />
          ))}
        </div>
      )}
    </div>
  );
}
