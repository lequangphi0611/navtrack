// Redirect sau createHolding/addTransaction/updateTransaction gắn thêm
// `?cashflowId=<id>` vào URL chi tiết vị thế (lib/routes.ts::holdingDetailAfterTransaction,
// issue #37, process/DECISION.md 2026-07-15 (3)) — cờ "vừa giao dịch xong" cho
// TransactionSnapshotBanner. Dùng pattern này khi chờ điều hướng sau các action
// đó thay vì so khớp URL tuyệt đối (deleteTransaction KHÔNG điều hướng, không
// cần helper này; saveNavOverride redirect KHÔNG gắn cashflowId, giữ
// page.waitForURL(exact string) như cũ).
export function afterTransactionUrl(baseUrl: string): RegExp {
  const escaped = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}\\?cashflowId=[a-z0-9]+$`);
}

// Bỏ query string khỏi URL vừa điều hướng tới (vd sau khi waitForURL khớp
// pattern có `?cashflowId=...`) — dùng làm base URL "sạch" cho các điều hướng/
// so khớp tiếp theo không liên quan tới cờ đó (vd `${holdingUrl}/price`,
// hoặc waitForURL(holdingUrl) sau saveNavOverride — action đó KHÔNG gắn
// cashflowId). `new URL(...).toString()` (thay vì `.split("?")[0]`) tránh lỗi
// `string | undefined` của noUncheckedIndexedAccess.
export function stripQuery(url: string): string {
  const parsed = new URL(url);
  parsed.search = "";
  return parsed.toString();
}
