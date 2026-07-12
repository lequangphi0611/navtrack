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
