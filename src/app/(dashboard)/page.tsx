import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

// Phase 1 chưa có dashboard tổng quan riêng — trang chủ chính là Danh mục (mockup 2b/2d).
export default function DashboardHomePage() {
  redirect(ROUTES.holdings);
}
