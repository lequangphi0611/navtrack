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
  // Phase 7 (issue #58/#101) — điều khoản trái phiếu (mockup 7a) và tất toán
  // đáo hạn (7e/7f). Điều khoản là route RIÊNG chứ không nhét vào form sửa vị
  // thế: chỉ vị thế loại BOND mới có, và là nơi mọi màn thiếu điều khoản (7g,
  // form ghi trái tức) trỏ người dùng tới.
  bondTerms: (holdingId: string) => `/holdings/${holdingId}/bond-terms`,
  maturitySettlement: (holdingId: string) => `/holdings/${holdingId}/maturity`,
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
  // Drill-down "% theo mã trong nhóm cổ phiếu" (issue #131/#132) — route con
  // riêng của /allocation, KHÔNG phải accordion mở tại chỗ (process/DECISION.md
  // 2026-08-16: nối tiếp tiền lệ /allocation đã là route riêng full-screen).
  allocationStock: "/allocation/stock",
  // Biến động NAV theo loại tài sản (issue #139/#141) — route ĐỘC LẬP, KHÔNG
  // nối tiếp `/allocation` dù cùng góc nhìn "theo loại tài sản": đây là drill-down
  // của NAV theo THỜI GIAN (Dashboard `NavTrendChart`), khác hẳn phân bổ % tại
  // MỘT thời điểm (`/allocation`) — process/decisions/pricing-and-valuation.md
  // 2026-08-18.
  navChart: "/nav-chart",
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

// Route đa lối-vào (fan-in): `backHref`/`closeHref` khai TĨNH chỉ đúng khi
// route đích có ĐÚNG 1 nơi trỏ tới. Route có ≥2 Link/router.push từ các màn
// khác nhau cùng trỏ tới cần biết user vừa đến TỪ đâu để quay lại đúng chỗ —
// xem docs/rules/component-architecture.md mục "Route đa lối-vào (fan-in)" +
// process/decisions/architecture-and-code-quality.md 2026-08-20.
//
// Nguồn điều hướng CỐ ĐỊNH, hữu hạn — union tổng hợp MỌI giá trị `from` dùng
// trong toàn app. Route fan-in mới → thêm 1 literal vào đây, KHÔNG tạo type/
// helper riêng cho từng route.
export type EntrySource = "dashboard" | "allocation-stock";

const ENTRY_SOURCES: readonly EntrySource[] = ["dashboard", "allocation-stock"];

export function isEntrySource(value: string | undefined): value is EntrySource {
  return ENTRY_SOURCES.includes(value as EntrySource);
}

// Gọi ở ENTRY POINT — nơi Link/router.push trỏ TỚI 1 route có nhiều lối vào.
export const withEntrySource = (href: string, source: EntrySource): string =>
  `${href}?from=${source}`;

// Gọi ở PAGE ĐÍCH của route fan-in. `sourceMap` chỉ liệt kê các EntrySource mà
// route ĐÓ thực sự phân biệt được. `from` vắng/không khớp -> luôn `fallback`
// (giữ đúng hành vi cũ khi deep-link/bookmark thẳng vào route).
export function resolveBackHref(
  from: string | undefined,
  sourceMap: Partial<Record<EntrySource, string>>,
  fallback: string,
): string {
  if (!isEntrySource(from)) return fallback;
  return sourceMap[from] ?? fallback;
}

// Ngoại lệ có chủ đích — /snapshots KHÔNG dùng cơ chế EntrySource ở trên:
// nguồn là `holdingId` ĐỘNG (không phải enum hữu hạn cố định), page đích tự
// verify ownership qua DB (isOwnHolding()) trước khi tin, không whitelist
// string như withEntrySource/resolveBackHref ở trên.
export const snapshotsFromHolding = (holdingId: string): string =>
  `${ROUTES.snapshots}?fromHolding=${holdingId}`;
