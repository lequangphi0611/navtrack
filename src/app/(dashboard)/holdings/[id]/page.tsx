import { Plus } from "lucide-react";
import Link from "next/link";

import { AssetTypeBadge } from "@/components/AssetTypeBadge";
import { MoneyValue } from "@/components/MoneyValue";
import { PageHeader } from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { TransactionHistoryList } from "@/features/holdings/components/TransactionHistoryList";
import { getHoldingDetail } from "@/features/holdings/queries";
import { formatQuantity, formatMoney } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
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
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title={holding.symbol} backHref={ROUTES.holdings} />

      <div className="flex items-center gap-2">
        <AssetTypeBadge assetType={holding.type} />
        {holding.name ? (
          <span className="truncate text-sm text-muted-foreground">
            {holding.name}
          </span>
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
            <div className="font-mono font-medium text-foreground tabular-nums">
              {formatQuantity(holding.quantity, holding.unit)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Giá vốn bình quân
            </div>
            <div className="font-mono font-medium text-foreground tabular-nums">
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
          href={ROUTES.newTransaction(holding.id)}
          className={cn(buttonVariants({ size: "sm" }), "gap-1 font-semibold")}
        >
          <Plus className="size-3.5" />
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
