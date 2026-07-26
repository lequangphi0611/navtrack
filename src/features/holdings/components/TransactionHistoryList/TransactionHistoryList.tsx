"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CashflowType } from "@prisma/client";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assertNever } from "@/lib/assert-never";
import { cashflowActionLabel } from "@/lib/cashflow-label";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { VariantProps } from "class-variance-authority";

import { deleteTransaction } from "../../actions";
import type { CashflowRow } from "../../types";

type TransactionHistoryListProps = {
  holdingId: string;
  unit: string;
  cashflows: CashflowRow[];
};

// Màu badge "Mua"/"Bán" theo CashflowType — switch exhaustive cùng lý do
// cashflowActionLabel() (src/lib/cashflow-label.ts), giữ riêng ở đây vì gắn
// với Badge variant (chi tiết UI), không thuộc lib dùng chung ngoài UI.
function cashflowBadgeVariant(
  type: CashflowType,
): NonNullable<VariantProps<typeof badgeVariants>["variant"]> {
  switch (type) {
    case "BUY":
      return "gain";
    case "SELL":
      return "destructive";
    default:
      return assertNever(type);
  }
}

function TransactionHistoryList({
  holdingId,
  unit,
  cashflows,
}: TransactionHistoryListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    router.refresh();
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
          data-testid="transaction-row"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
        >
          <Badge variant={cashflowBadgeVariant(cf.type)}>
            {cashflowActionLabel(cf.type)}
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
    </div>
  );
}

export { TransactionHistoryList };
export type { TransactionHistoryListProps };
