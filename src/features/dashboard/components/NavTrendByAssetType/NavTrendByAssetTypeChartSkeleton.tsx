import { Skeleton } from "@/components/ui/skeleton";

// Khớp khung NavTrendByAssetTypeChart thật (139f) — 5 chip filter pill skeleton
// (rộng khác nhau, cao ~31px), block header (nhãn 130×9 + số lớn 172×24 + badge
// % 66×23), cột trục Y 4 dòng, khối chart full, 5 nhãn trục X, bộ chọn kỳ
// full-width cao 41px, khối note 3 dòng — Server Component thuần, không nhận
// data (component-architecture.md mục "Quy ước skeleton").
function NavTrendByAssetTypeChartSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="mb-3.5 flex gap-1.75">
        <Skeleton className="h-7.75 w-18.5 shrink-0 rounded-full" />
        <Skeleton className="h-7.75 w-24.5 shrink-0 rounded-full" />
        <Skeleton className="h-7.75 w-19 shrink-0 rounded-full" />
        <Skeleton className="h-7.75 w-16 shrink-0 rounded-full" />
        <Skeleton className="h-7.75 w-14 shrink-0 rounded-full" />
      </div>

      <div className="rounded-[18px] border border-border bg-card p-4 pt-4">
        <div className="flex items-end justify-between gap-2.5">
          <div>
            <Skeleton className="h-2.25 w-32.5" />
            <Skeleton className="mt-2 h-6 w-43 rounded-[7px]" />
          </div>
          <Skeleton className="h-5.75 w-16.5 shrink-0 rounded-full" />
        </div>

        <div className="mt-4 flex gap-2">
          <div className="flex h-33 w-11 shrink-0 flex-col items-end justify-between">
            <Skeleton className="h-2 w-8.5" />
            <Skeleton className="h-2 w-8.5" />
            <Skeleton className="h-2 w-8.5" />
            <Skeleton className="h-2 w-8.5" />
          </div>
          <Skeleton className="h-33 flex-1 rounded-[10px]" />
        </div>
        <div className="mt-2.5 flex justify-between pl-13">
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-2 w-8" />
        </div>

        <Skeleton className="mt-3.5 h-10.25 w-full rounded-[11px]" />

        <div className="mt-3 flex gap-2.25 rounded-xl border border-border bg-background p-2.75">
          <Skeleton className="size-4.25 shrink-0 rounded-[5px]" />
          <div className="flex-1">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="mt-1.5 h-2 w-11/12" />
            <Skeleton className="mt-1.5 h-2 w-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
}

export { NavTrendByAssetTypeChartSkeleton };
