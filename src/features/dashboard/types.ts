import type { DashboardScreenProps } from "@/features/dashboard/components/DashboardScreen";

// Shape trả về bởi getPortfolioValuation() (queries.ts) — khớp NGUYÊN VĂN
// DashboardScreenProps TRỪ displayName (lấy từ session ở page.tsx, không phải
// việc của query) và hidden (cờ ẩn số tiền, không set ở tầng dữ liệu). Dùng
// Omit thay vì khai lại để không lệch hợp đồng khi DashboardScreen đổi Props.
export type PortfolioValuation = Omit<
  DashboardScreenProps,
  "displayName" | "hidden"
>;
