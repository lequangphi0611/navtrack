import { TransactionForm } from "@/features/holdings/components/TransactionForm";

type NewTransactionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewTransactionPage({
  params,
}: NewTransactionPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Thêm giao dịch
      </h1>
      <TransactionForm mode="create" holdingId={id} />
    </div>
  );
}
