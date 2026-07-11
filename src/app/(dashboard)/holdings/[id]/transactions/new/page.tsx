import { Suspense } from "react";

import { PageHeader } from "@/components/PageHeader";
import { NewTransactionFormSection } from "@/features/holdings/components/NewTransactionFormSection";
import { TransactionFormSkeleton } from "@/features/holdings/components/TransactionForm";
import { ROUTES } from "@/lib/routes";

type NewTransactionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewTransactionPage({
  params,
}: NewTransactionPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Giao dịch mới"
        backHref={ROUTES.holdingDetail(id)}
        variant="close"
      />
      <Suspense fallback={<TransactionFormSkeleton />}>
        <NewTransactionFormSection holdingId={id} />
      </Suspense>
    </div>
  );
}
