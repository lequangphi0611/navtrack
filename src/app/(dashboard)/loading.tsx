import { DashboardScreenSkeleton } from "@/features/dashboard/components/DashboardScreen";

// page.tsx ("/") giờ đã sync, mọi query nằm trong Suspense riêng (issue #77)
// nên fallback này không còn cần thiết CHO CHÍNH route "/" — Suspense trong
// page.tsx tự hiện DashboardScreenSkeleton ngay. VẪN GIỮ file vì loading.tsx
// của route group `(dashboard)` được các route CON chưa có loading.tsx riêng
// kế thừa làm fallback (vd /snapshots — page.tsx await tuần tự, không
// Suspense) — xoá sẽ làm các route đó mất hẳn skeleton lúc điều hướng, đứng
// hình tới khi data xong thay vì hiện loading. Xem settings/loading.tsx (comment
// tương tự) cho route đã tự tách để tránh kế thừa nhầm hình dạng sai.
export default function DashboardLoading() {
  return <DashboardScreenSkeleton />;
}
