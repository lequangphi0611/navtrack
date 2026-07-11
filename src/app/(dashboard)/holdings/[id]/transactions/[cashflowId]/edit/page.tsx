import { Suspense } from "react";

import { PageHeader } from "@/components/PageHeader";
import { EditTransactionFormSection } from "@/features/holdings/components/EditTransactionFormSection";
import { TransactionFormSkeleton } from "@/features/holdings/components/TransactionForm";
import { ROUTES } from "@/lib/routes";

type EditTransactionPageProps = {
  params: Promise<{ id: string; cashflowId: string }>;
};

export default async function EditTransactionPage({
  params,
}: EditTransactionPageProps) {
  const { id, cashflowId } = await params;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Sửa giao dịch"
        backHref={ROUTES.holdingDetail(id)}
        variant="close"
      />
      <Suspense fallback={<TransactionFormSkeleton />}>
        <EditTransactionFormSection holdingId={id} cashflowId={cashflowId} />
      </Suspense>
    </div>
  );
}
