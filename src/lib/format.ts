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

const TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const COMPACT_MONEY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

// Ngưỡng rút gọn — kiểm tra từ lớn xuống nhỏ, giá trị đầu tiên khớp thắng.
const COMPACT_MONEY_TIERS: {
  threshold: number;
  divisor: number;
  suffix: string;
}[] = [
  { threshold: 1_000_000_000, divisor: 1_000_000_000, suffix: " tỷ" },
  { threshold: 1_000_000, divisor: 1_000_000, suffix: "tr" },
  { threshold: 1_000, divisor: 1_000, suffix: "k" },
];

// value là Decimal đã serialize thành string ở biên server — không nhận number
// (xem docs/rules/component-architecture.md#format-locale).
// compact: rút gọn "200.000.000 ₫" -> "200tr" cho chỗ hiển thị hẹp (thẻ nhỏ, badge,
// dòng danh sách). Dưới 1.000 hoặc không truyền compact -> giữ nguyên định dạng đầy
// đủ có ký hiệu ₫ như cũ. Không tự đổi tier sau khi làm tròn (vd 999.999 rơi vào
// tier k -> "1.000k" thay vì nhảy sang "1tr") — chấp nhận, không thêm logic phức
// tạp cho ca hiếm này.
export function formatMoney(
  value: string,
  opts?: { hidden?: boolean; compact?: boolean },
): string {
  if (opts?.hidden) return "••••••";
  const amount = Number(value);
  if (opts?.compact) {
    const abs = Math.abs(amount);
    const tier = COMPACT_MONEY_TIERS.find((t) => abs >= t.threshold);
    if (tier) {
      const sign = amount < 0 ? "-" : "";
      const shortValue = COMPACT_MONEY_FORMATTER.format(abs / tier.divisor);
      return `${sign}${shortValue}${tier.suffix}`;
    }
  }
  return MONEY_FORMATTER.format(amount);
}

export function formatQuantity(value: string, unit: string): string {
  return `${QUANTITY_FORMATTER.format(Number(value))} ${unit}`;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return DATE_FORMATTER.format(date);
}

// "15:42" — HH:mm giờ Việt Nam, dùng cho "Đã chốt lúc HH:mm" (SnapshotTodayCard,
// SnapshotFreezeSheet — features/snapshots). Nhận string ISO hoặc Date, giống formatDate.
export function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return TIME_FORMATTER.format(date);
}

// "05/2024" — MM/yyyy giờ Việt Nam, dùng cho khoảng thời gian nắm giữ vị thế
// đã đóng (ClosedPositionSheet, mục 12 phase-6.md: "tháng mua đầu -> tháng bán
// hết cuối"), nơi năm QUAN TRỌNG (khác formatDayMonth) nhưng ngày cụ thể trong
// tháng không cần thiết.
const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  month: "2-digit",
  year: "numeric",
});

export function formatMonthYear(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return MONTH_YEAR_FORMATTER.format(date);
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

// Phần trăm THUẦN 1 chữ số thập phân, KHÔNG kèm dấu "%" và KHÔNG ép dấu +
// tường minh (số âm vẫn hiện dấu trừ mặc định của Intl) — dùng cho
// DividendRecordedResult.xirrBeforePercent/xirrAfterPercent (mockup Phase 4,
// 4d: "17,4% → 17,9%"), nơi component tự nối literal "%" ở giữa hai giá trị
// nên không dùng được formatSignedPercent (đã tự kèm "%" + dấu +/−).
export function formatXirrBarePercent(value: number): string {
  return PERCENT_FORMATTER.format(value);
}

// Màu theo dấu giá trị (dùng cho XIRR, lãi/lỗ, chênh lệch NAV...) — 0 trung
// tính, dương = "text-gain", âm = "text-destructive". Nguồn sự thật DUY NHẤT,
// dùng chung ở ReturnMetrics và DashboardScreen (navDelta).
export function signColorClass(value: number): string {
  if (value === 0) return "text-foreground";
  return value > 0 ? "text-gain" : "text-destructive";
}
