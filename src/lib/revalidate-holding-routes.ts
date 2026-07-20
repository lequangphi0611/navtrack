import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/routes";

// Tập route phụ thuộc trực tiếp lên quantity/NAV/PnL của MỘT Holding — mọi
// Server Action ghi Cashflow/NavOverride/Dividend (thứ ảnh hưởng SL hoặc giá)
// đều phải gọi hàm này thay vì tự revalidate rải rác từng route (docs/rules/
// component-architecture.md mục "Server Action & error contract" — mỗi action
// tự chịu trách nhiệm revalidate đủ route phụ thuộc, không dựa vào side-effect
// của action/hàm khác). server-only (revalidatePath) — KHÔNG đặt trong
// lib/routes.ts (routes.ts được ~15 client component "use client" import,
// revalidatePath lọt vào đó sẽ vỡ bundle client).
export function revalidateHoldingDependentRoutes(holdingId: string): void {
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.holdings);
  revalidatePath(ROUTES.holdingsClosed);
  revalidatePath(ROUTES.holdingDetail(holdingId));
}
