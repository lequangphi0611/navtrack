import { Skeleton } from "@/components/ui/skeleton";
import { TransactionFormSkeleton } from "@/features/holdings/components/TransactionForm";

export default function EditTransactionLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5">
      <div className="flex items-center gap-3.5 border-b border-border pb-3">
        <Skeleton className="size-8 rounded-[10px]" />
        <Skeleton className="h-5 w-28" />
      </div>
      <TransactionFormSkeleton />
    </div>
  );
}
