import { Skeleton } from "@/components/ui/skeleton";

// Khớp hình dạng TransactionForm: toggle Mua/Bán, pill HoldingSwitcher (route
// "new" — issue #138), các field, nút submit. Route "edit" thực ra dùng khối
// card vị thế tĩnh (thấp + không bo tròn bằng pill switcher) thay vì pill này
// — 2 route dùng chung 1 skeleton, chấp nhận lệch nhẹ ở route edit vì không
// rõ rệt khi soi mắt (xem docs/rules/component-architecture.md mục "Quy ước
// skeleton").
function TransactionFormSkeleton() {
  return (
    <div className="flex flex-col gap-4.5">
      <Skeleton className="h-11 rounded-xl" />
      <Skeleton className="h-17.5 rounded-2xl" />
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
