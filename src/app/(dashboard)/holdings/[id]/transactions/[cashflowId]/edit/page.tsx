import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { TransactionForm } from "@/features/holdings/components/TransactionForm";
import { getHoldingDetail } from "@/features/holdings/queries";
import { ROUTES } from "@/lib/routes";

type EditTransactionPageProps = {
  params: Promise<{ id: string; cashflowId: string }>;
};

export default async function EditTransactionPage({
  params,
}: EditTransactionPageProps) {
  const { id, cashflowId } = await params;
  const holding = await getHoldingDetail(id);
  const cashflow = holding.cashflows.find((cf) => cf.id === cashflowId);
  if (!cashflow) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Sửa giao dịch"
        backHref={ROUTES.holdingDetail(id)}
        variant="close"
      />
      <TransactionForm
        mode="edit"
        holdingId={id}
        holding={{
          symbol: holding.symbol,
          name: holding.name,
          quantity: holding.quantity,
          unit: holding.unit,
        }}
        cashflow={cashflow}
      />
    </div>
  );
}
