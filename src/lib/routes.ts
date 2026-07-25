// Một nguồn sự thật cho mọi đường dẫn nội bộ — Link/redirect/revalidatePath/backHref
// đều phải qua đây, không hardcode string route rải rác (xem docs/rules/typescript-style.md).
export const ROUTES = {
  signIn: "/sign-in",
  // Prefix route handler Auth.js — không phải app route, nhưng vẫn qua đây để
  // proxy.ts (middleware) không hardcode string riêng.
  apiAuth: "/api/auth",
  // Bề mặt preview component — dev-only. proxy.ts dùng prefix này: cho qua không
  // cần đăng nhập KHI dev (soi UI component cô lập qua Playwright MCP), trả 404
  // khi production. Xem src/app/preview/layout.tsx + docs/rules/component-architecture.md.
  preview: "/preview",
  // Trang chủ (Tổng quan/Dashboard) — src/app/(dashboard)/page.tsx.
  dashboard: "/",
  holdings: "/holdings",
  holdingsClosed: "/holdings/closed",
  newHolding: "/holdings/new",
  holdingDetail: (holdingId: string) => `/holdings/${holdingId}`,
  newTransaction: (holdingId: string) =>
    `/holdings/${holdingId}/transactions/new`,
  editTransaction: (holdingId: string, cashflowId: string) =>
    `/holdings/${holdingId}/transactions/${cashflowId}/edit`,
  navOverrideNew: (holdingId: string) => `/holdings/${holdingId}/price`,
  settings: "/settings",
  members: "/settings/members",
  inviteMember: "/settings/members/invite",
  // Route handler ghi cookie mốc chốt rồi redirect về /settings — xem
  // src/app/api/cutoff/route.ts. Chỉ nhận 3 key cố định (CUSTOM chưa wiring).
  cutoffAction: (key: "TODAY" | "END_OF_MONTH" | "END_OF_YEAR") =>
    `/api/cutoff?key=${key}`,
  // Phase 3 (issue #35) — chuỗi snapshot NAV + chi tiết + cài đặt lịch chốt tự động.
  snapshots: "/snapshots",
  snapshotDetail: (snapshotId: string) => `/snapshots/${snapshotId}`,
  snapshotSchedule: "/settings/snapshot-schedule",
  // Phase 4 (issue #51) — ghi nhận cổ tức. KHÔNG có route lịch sử toàn danh mục
  // (khác snapshots): mockup "Phase 4 Screens" 4e scope theo TỪNG Holding, không
  // portfolio-wide — xem process/UI_phase_4.md mục "Điểm lệch so với plan".
  // `newDividend` dùng cho CẢ hai lối vào (nút "Ghi cổ tức" ở HoldingDetailScreen
  // VÀ mục "Đổi mã" trong HoldingSwitcher) vì DividendForm luôn hiện switcher.
  newDividend: (holdingId: string) => `/holdings/${holdingId}/dividends/new`,
  // Entry độc lập từ Dashboard (chưa có ngữ cảnh Holding) — page.tsx tự chọn
  // Holding mặc định (Holding đang mở đầu tiên) rồi render DividendForm như trên.
  newDividendStandalone: "/dividends/new",
  dividendHistory: (holdingId: string) => `/holdings/${holdingId}/dividends`,
  // Phase 6 (mục 10 phase-6.md) — màn phân bổ tài sản chi tiết (donut), route
  // riêng full-screen (process/DECISION.md 2026-07-21: mockup vẽ full-screen
  // với back button, không phải Sheet).
  allocation: "/allocation",
} as const;

// Khai NGOÀI object ROUTES (tham chiếu ROUTES.holdingDetail — object literal không tự
// tham chiếu chính nó được lúc khởi tạo). Query param `cashflowId` cho page.tsx biết
// "vừa ghi giao dịch xong" để dựng TransactionSnapshotBanner (issue #37) — không dùng
// cookie, page.tsx tự verify cashflowId thuộc đúng holding trước khi tin (xem
// features/holdings/queries.ts::getJustRecordedBanner).
export const holdingDetailAfterTransaction = (
  holdingId: string,
  cashflowId: string,
): string => `${ROUTES.holdingDetail(holdingId)}?cashflowId=${cashflowId}`;
