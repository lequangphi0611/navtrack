import { Skeleton } from "@/components/ui/skeleton";

// Khớp hình dạng DashboardQuickMenu ở trạng thái đóng (mặc định, trước khi
// user tương tác) — FAB tròn nổi góc dưới-phải, cùng vị trí `fixed` + kích
// thước nút thật (size-14.5, rounded-[30%]). Không mô phỏng trạng thái mở
// (danh sách hành động) vì đó là state UI thuần tuý, không liên quan tới data
// đang tải.
function DashboardQuickMenuSkeleton() {
  return (
    <div className="fixed right-5 bottom-37.5 z-50">
      <Skeleton className="size-14.5 rounded-[30%]" />
    </div>
  );
}

export { DashboardQuickMenuSkeleton };
