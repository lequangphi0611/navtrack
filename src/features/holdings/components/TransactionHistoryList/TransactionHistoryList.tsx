"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

import { deleteTransaction, loadMoreCashflows } from "../../actions";
import type { CashflowRow } from "../../types";

type TransactionHistoryListProps = {
  holdingId: string;
  unit: string;
  cashflows: CashflowRow[];
  // Cursor của trang thứ 2 (null = trang đầu đã là toàn bộ lịch sử) — khởi tạo
  // state "Xem thêm" cục bộ, xem docs/rules/performance.md mục pagination.
  initialNextCursor: string | null;
};

function TransactionHistoryList({
  holdingId,
  unit,
  cashflows: initialCashflows,
  initialNextCursor,
}: TransactionHistoryListProps) {
  const router = useRouter();
  const [cashflows, setCashflows] = useState<CashflowRow[]>(initialCashflows);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  async function handleDelete(cashflowId: string) {
    if (!window.confirm("Xóa giao dịch này?")) return;

    setPendingId(cashflowId);
    setError(null);
    const result = await deleteTransaction({ cashflowId });
    setPendingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCashflows((prev) => prev.filter((cf) => cf.id !== cashflowId));
    // Vẫn cần — đồng bộ SL/giá vốn hiển thị ở component cha (HoldingDetailScreen),
    // không chỉ danh sách giao dịch. Cursor theo `id` nên xóa 1 dòng giữa không
    // làm lệch cursor các trang đã tải.
    router.refresh();
  }

  async function handleLoadMore() {
    if (!nextCursor) return;

    setIsLoadingMore(true);
    setLoadMoreError(null);
    const result = await loadMoreCashflows({ holdingId, cursor: nextCursor });
    setIsLoadingMore(false);

    if (!result.ok) {
      setLoadMoreError(result.error);
      return;
    }
    setCashflows((prev) => [...prev, ...result.data.cashflows]);
    setNextCursor(result.data.nextCursor);
  }

  if (cashflows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Chưa có giao dịch nào.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {cashflows.map((cf) => (
        <div
          key={cf.id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
        >
          <Badge variant={cf.type === "BUY" ? "gain" : "destructive"}>
            {cf.type === "BUY" ? "Mua" : "Bán"}
          </Badge>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">
              {formatQuantity(cf.quantity, unit)} @{" "}
              {formatMoney(cf.pricePerUnit)}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(cf.date)}
              {cf.note ? ` · ${cf.note}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={ROUTES.editTransaction(holdingId, cf.id)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Sửa
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pendingId === cf.id}
              onClick={() => handleDelete(cf.id)}
            >
              Xóa
            </Button>
          </div>
        </div>
      ))}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {nextCursor ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoadingMore}
          onClick={handleLoadMore}
        >
          {isLoadingMore ? "Đang tải..." : "Xem thêm"}
        </Button>
      ) : null}
      {loadMoreError ? (
        <p className="text-xs text-destructive">{loadMoreError}</p>
      ) : null}
    </div>
  );
}

export { TransactionHistoryList };
export type { TransactionHistoryListProps };
