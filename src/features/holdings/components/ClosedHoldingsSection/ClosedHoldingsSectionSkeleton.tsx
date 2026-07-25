import { Skeleton } from "@/components/ui/skeleton";

// Khớp khung ClosedHoldingsSection: strip 2 stat card + 3 dòng vị thế (mockup
// 6h) — KHÁC HoldingsListSkeleton (gom nhóm theo AssetType, dùng cho tab "Đang
// mở"), colocate riêng vì hình dạng khác hẳn (không có nhóm/expand, có summary
// strip).
function ClosedHoldingsSectionSkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5"
          >
            <Skeleton className="size-10" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { ClosedHoldingsSectionSkeleton };
