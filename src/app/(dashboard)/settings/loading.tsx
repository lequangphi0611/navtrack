import { Skeleton } from "@/components/ui/skeleton";

// Route "/settings" giờ await getCutoffSelection() + getCutoffOptions()
// (business-implementer, "Wire mốc chốt thật") — không có loading.tsx riêng
// sẽ kế thừa nhầm (dashboard)/loading.tsx (DashboardScreenSkeleton, khác hẳn
// khung Cài đặt). Khung khớp SettingsScreen: header back + mục Thành viên +
// card Mốc chốt định giá (3 hàng + hàng Tuỳ chỉnh) + hàng Đăng xuất.
export default function SettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 pb-28">
      <div className="flex items-center gap-3.5 border-b border-border pb-3">
        <Skeleton className="size-8 rounded-[10px]" />
        <Skeleton className="h-5 w-20" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 rounded-2xl" />

        <div className="rounded-2xl border border-primary/30 bg-card p-4">
          <Skeleton className="mb-3 h-4 w-36" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        </div>

        <Skeleton className="mt-1 h-14 rounded-2xl" />
      </div>
    </div>
  );
}
