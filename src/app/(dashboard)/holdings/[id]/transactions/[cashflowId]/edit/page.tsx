import { notFound } from "next/navigation";

import { TransactionForm } from "@/features/holdings/components/TransactionForm";
import { getHoldingDetail } from "@/features/holdings/queries";

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
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Sửa giao dịch
      </h1>
      <TransactionForm mode="edit" holdingId={id} cashflow={cashflow} />
    </div>
  );
}
