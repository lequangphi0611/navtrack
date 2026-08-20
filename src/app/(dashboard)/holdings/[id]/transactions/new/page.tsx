import { Suspense } from "react";

import { PageHeader } from "@/components/PageHeader";
import { NewTransactionFormSection } from "@/features/holdings/components/NewTransactionFormSection";
import { TransactionFormSkeleton } from "@/features/holdings/components/TransactionForm";
import { ROUTES, resolveBackHref } from "@/lib/routes";

type NewTransactionPageProps = {
  params: Promise<{ id: string }>;
  // ?from=<path> — route fan-in: entry đúng (nút "Giao dịch" ở
  // HoldingDetailScreen) không truyền from, fallback về ROUTES.holdingDetail
  // như cũ; entry từ TransactionHoldingPicker (FAB Dashboard) gắn
  // `from=ROUTES.dashboard` để quay lại Dashboard thay vì holding user chưa
  // từng ghé — xem lib/routes.ts.
  searchParams: Promise<{ from?: string }>;
};

export default async function NewTransactionPage({
  params,
  searchParams,
}: NewTransactionPageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = resolveBackHref(from, ROUTES.holdingDetail(id));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title="Giao dịch mới" backHref={backHref} variant="close" />
      <Suspense fallback={<TransactionFormSkeleton />}>
        <NewTransactionFormSection holdingId={id} />
      </Suspense>
    </div>
  );
}
