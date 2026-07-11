import { HoldingsGroupCardSkeleton } from "@/features/holdings/components/HoldingsGroupCard";

// Khớp hình dạng HoldingsList (gom nhóm theo loại tài sản) — vài card giả lập.
function HoldingsListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <HoldingsGroupCardSkeleton />
      <HoldingsGroupCardSkeleton />
    </div>
  );
}

export { HoldingsListSkeleton };
