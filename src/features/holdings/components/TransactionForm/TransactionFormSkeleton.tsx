import { Skeleton } from "@/components/ui/skeleton";

// Khớp hình dạng TransactionForm: toggle Mua/Bán, card vị thế, các field, nút submit.
function TransactionFormSkeleton() {
  return (
    <div className="flex flex-col gap-4.5">
      <Skeleton className="h-11 rounded-xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      </div>
      {/* Card "Thuế bán" + "Phí giao dịch" tự-điền-sửa-được (Phase 5) */}
      <Skeleton className="h-28.5 rounded-2xl" />
      <Skeleton className="h-28.5 rounded-2xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-11 rounded-xl" />
      </div>
      <Skeleton className="h-12 rounded-[13px]" />
    </div>
  );
}

export { TransactionFormSkeleton };
