import Link from "next/link";

import { MoneyValue } from "@/components/MoneyValue";
import { AssetTypeBadge } from "@/components/AssetTypeBadge";
import { buttonVariants } from "@/components/ui/button";
import { TransactionHistoryList } from "@/features/holdings/components/TransactionHistoryList";
import { getHoldingDetail } from "@/features/holdings/queries";
import { formatQuantity, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type HoldingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function HoldingDetailPage({
  params,
}: HoldingDetailPageProps) {
  const { id } = await params;
  const holding = await getHoldingDetail(id);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {holding.symbol}
          </h1>
          <AssetTypeBadge assetType={holding.type} />
        </div>
        {holding.name ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{holding.name}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">
          Tổng vốn đã bỏ vào
        </div>
        <MoneyValue value={holding.totalCostBasis} />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Số lượng</div>
            <div className="font-medium text-foreground">
              {formatQuantity(holding.quantity, holding.unit)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Giá vốn bình quân
            </div>
            <div className="font-medium text-foreground">
              {formatMoney(holding.avgCost)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Lịch sử giao dịch
        </h2>
        <Link
          href={`/holdings/${holding.id}/transactions/new`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Thêm giao dịch
        </Link>
      </div>

      <TransactionHistoryList
        holdingId={holding.id}
        unit={holding.unit}
        cashflows={holding.cashflows}
      />
    </div>
  );
}
