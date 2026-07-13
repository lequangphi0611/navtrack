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

// Chuỗi input thô (từ event.target.value, có thể còn "." / "," / ký tự khác
// nếu user dán) -> chuỗi canonical (chỉ digit + tối đa 1 dấu "." thập phân,
// khớp decimalString ở features/holdings/schemas.ts). Dùng bởi MoneyInput —
// KHÔNG gắn thẳng chuỗi hiển thị (có dấu phân cách) vào input có `name`, vì
// `new Decimal("100.000")` sẽ hiểu "." là thập phân (= 100) thay vì 100.000.
// Quy ước vi-VN: nếu có "," -> dấu "," ĐẦU TIÊN là thập phân, mọi "." trước đó
// là dấu nhóm hàng nghìn; nếu chỉ có "." -> toàn bộ là dấu nhóm hàng nghìn
// (app không có ca thập phân kiểu Mỹ).
export function parseMoneyInputValue(raw: string): string {
  const stripped = raw.replace(/[^0-9.,]/g, "");
  const firstCommaIndex = stripped.indexOf(",");
  if (firstCommaIndex !== -1) {
    const integerPart = stripped.slice(0, firstCommaIndex).replace(/\./g, "");
    const decimalPart = stripped
      .slice(firstCommaIndex + 1)
      .replace(/[.,]/g, "");
    return `${integerPart}.${decimalPart}`;
  }
  return stripped.replace(/\./g, "");
}

// Canonical (digit + tối đa 1 dấu ".") -> chuỗi hiển thị vi-VN (dấu "." nhóm
// hàng nghìn, dấu "," thập phân) — ngược lại với parseMoneyInputValue. Dùng
// để render displayValue của MoneyInput mỗi lần render, tính lại từ prop
// value thay vì giữ state hiển thị riêng.
export function formatMoneyInputDisplay(canonical: string): string {
  if (canonical === "") return "";
  const dotIndex = canonical.indexOf(".");
  const hasDot = dotIndex !== -1;
  const integerPart = hasDot ? canonical.slice(0, dotIndex) : canonical;
  const decimalPart = hasDot ? canonical.slice(dotIndex + 1) : "";
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return hasDot ? `${formattedInteger},${decimalPart}` : formattedInteger;
}
