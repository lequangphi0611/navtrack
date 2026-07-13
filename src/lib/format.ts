const MONEY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

const QUANTITY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 4,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const PERCENT_FORMATTER = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// value là Decimal đã serialize thành string ở biên server — không nhận number
// (xem docs/rules/component-architecture.md#format-locale).
export function formatMoney(
  value: string,
  opts?: { hidden?: boolean },
): string {
  if (opts?.hidden) return "••••••";
  return MONEY_FORMATTER.format(Number(value));
}

export function formatQuantity(value: string, unit: string): string {
  return `${QUANTITY_FORMATTER.format(Number(value))} ${unit}`;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return DATE_FORMATTER.format(date);
}

// Ngắn gọn hơn formatDate (không năm) — dùng cho ghi chú kiểu "EOD 10/07" nơi
// năm không quan trọng (vd priceFreshnessNote ở Dashboard, luôn nói về mốc gần
// đây). Cắt từ formatDate thay vì Intl.DateTimeFormat riêng chỉ day/month: vi-VN
// đổi sang dấu "-" (thay vì "/") khi bỏ year khỏi options, lệch định dạng dd/MM/yyyy
// dùng chung toàn app.
export function formatDayMonth(value: string | Date): string {
  return formatDate(value).slice(0, 5);
}

// Phần trăm có dấu +/− tường minh (vd "+12.3%", "−4.5%", "0.0%" không dấu),
// 1 chữ số thập phân — nguồn sự thật DUY NHẤT cho công thức này, dùng chung ở
// ReturnMetrics, DashboardScreen (navDeltaPercent), PercentChange, và
// formatXirrLabel (settings/queries.ts). Trước đây 4 nơi tự cài lại y hệt
// logic (Intl.NumberFormat("vi-VN", {minimumFractionDigits:1}) + dấu +/−),
// dễ lệch câu chữ khi sửa 1 chỗ quên chỗ khác.
export function formatSignedPercent(
  value: number,
  opts?: { suffix?: string },
): string {
  const magnitude = PERCENT_FORMATTER.format(Math.abs(value));
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${magnitude}%${opts?.suffix ?? ""}`;
}

// Phần trăm KHÔNG dấu, 1 chữ số thập phân — khác formatSignedPercent ở chỗ
// input ở đây luôn đã ≥ 0 (tỷ lệ phân bổ NAV theo loại tài sản, AllocationBar)
// nên không cần +/−, format thẳng value thay vì Math.abs(value).
export function formatPercent(value: number): string {
  return `${PERCENT_FORMATTER.format(value)}%`;
}

// Màu theo dấu giá trị (dùng cho XIRR, lãi/lỗ, chênh lệch NAV...) — 0 trung
// tính, dương = "text-gain", âm = "text-destructive". Nguồn sự thật DUY NHẤT,
// dùng chung ở ReturnMetrics và DashboardScreen (navDelta).
export function signColorClass(value: number): string {
  if (value === 0) return "text-foreground";
  return value > 0 ? "text-gain" : "text-destructive";
}
