import type { XirrResult } from "@/components/ReturnMetrics";

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

const MONTH_YEAR_PARTS_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  month: "2-digit",
  year: "numeric",
});

const DAY_MONTH_PARTS_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
});

const PERCENT_FORMATTER = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const PERCENT_FORMATTER_PRECISE = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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
  return `${formatQuantityNumber(value)} ${unit}`;
}

// Số lượng THUẦN đã format theo vi-VN, KHÔNG kèm đơn vị — dùng khi đơn vị hiển
// thị TÁCH RIÊNG khỏi con số qua một prop khác (vd DuplicateHoldingAlert nhận
// `existingQuantity`/`existingUnit` là 2 prop riêng, ghép trong JSX của chính
// nó — cha nối thêm unit vào formatQuantity() sẽ ra "8.000 cổ phần cổ phần").
// Khác formatQuantity() ở trên (luôn tự nối "<số> <đơn vị>" thành MỘT chuỗi).
export function formatQuantityNumber(value: string): string {
  return QUANTITY_FORMATTER.format(Number(value));
}

// Số tiền THUẦN đã format theo vi-VN (dấu chấm phân cách nghìn, không thập
// phân), KHÔNG kèm ký hiệu "₫" — dùng khi ký hiệu tiền tệ được component cha
// tự ghép vào câu văn riêng (vd DuplicateHoldingAlert: "giá vốn {existingAvgCost}
// ₫"). Khác formatMoney() (luôn tự kèm "₫" qua Intl currency formatter).
const MONEY_NUMBER_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

export function formatMoneyNumber(value: string): string {
  return MONEY_NUMBER_FORMATTER.format(Number(value));
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
// tháng không cần thiết. Tự ghép "/" từ formatToParts() (KHÔNG cắt chuỗi
// formatDate()) — vi-VN đổi sang dấu "-" khi Intl.DateTimeFormat chỉ khai
// month/year (thiếu day), nên phải tự lấy riêng từng phần rồi nối "/" tay.
// Cách cũ (slice formatDate()) coupling ngầm vào ĐÚNG độ rộng/thứ tự output
// "dd/MM/yyyy" — đổi format đó ở formatDate() sẽ âm thầm làm hàm này sai mà
// compiler không báo (code review #12).
export function formatMonthYear(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = MONTH_YEAR_PARTS_FORMATTER.formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${month}/${year}`;
}

// Ngắn gọn hơn formatDate (không năm) — dùng cho ghi chú kiểu "EOD 10/07" nơi
// năm không quan trọng (vd priceFreshnessNote ở Dashboard, luôn nói về mốc gần
// đây). Tự ghép "/" từ formatToParts() — cùng lý do formatMonthYear phía trên
// (vi-VN đổi sang dấu "-" khi thiếu year trong options; slice formatDate()
// coupling ngầm vào format "dd/MM/yyyy", code review #12).
export function formatDayMonth(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = DAY_MONTH_PARTS_FORMATTER.formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${day}/${month}`;
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

// Phần trăm KHÔNG dấu, 2 chữ số thập phân — dùng riêng cho costDragPercent
// ("Chi phí ăn mòn", PnlCostDragCard/CostDragSheet). Khác formatPercent (1 chữ
// số): mẫu số ở đây là grossInvested nên giá trị thường < 1% (vd ví dụ
// docs/domain/07-tax.md: 0.46%) — làm tròn 1 chữ số biến 0.46% thành "0.5%",
// lệch ~9% trên một con số vốn đã bé. KHÔNG dùng cho contributionPercent
// (breakdown trong CostDragSheet) — đó là % đóng góp tương đối trên tổng
// costDragAmount (cùng thang với AllocationBar), 1 chữ số vẫn đủ.
export function formatCostDragPercent(value: number): string {
  return `${PERCENT_FORMATTER_PRECISE.format(value)}%`;
}

// Phần trăm THUẦN 1 chữ số thập phân, KHÔNG kèm dấu "%" và KHÔNG ép dấu +
// tường minh (số âm vẫn hiện dấu trừ mặc định của Intl) — dùng cho
// DividendRecordedResult.xirrBeforePercent/xirrAfterPercent (mockup Phase 4,
// 4d: "17,4% → 17,9%"), nơi component tự nối literal "%" ở giữa hai giá trị
// nên không dùng được formatSignedPercent (đã tự kèm "%" + dấu +/−).
export function formatXirrBarePercent(value: number): string {
  return PERCENT_FORMATTER.format(value);
}

// "Chưa tính được" khi status !== "OK", ngược lại formatSignedPercent + suffix
// "/năm" — nguồn sự thật DUY NHẤT cho câu "XIRR chưa tính được", dùng chung ở
// CutoffPicker (qua settings/queries.ts), ClosedHoldingRow, ClosedPositionSheet,
// ClosedHoldingsSummaryStrip. Trước đây re-implement rải rác, lệch chữ hoa/
// thường ("Chưa tính được" vs "chưa tính được", code review #10).
export function formatXirrLabel(xirr: XirrResult): string {
  if (xirr.status !== "OK") return "Chưa tính được";
  return formatSignedPercent(xirr.percentPerYear, { suffix: "/năm" });
}

// Màu theo dấu giá trị (dùng cho XIRR, lãi/lỗ, chênh lệch NAV...) — 0 trung
// tính, dương = "text-gain", âm = "text-destructive". Nguồn sự thật DUY NHẤT,
// dùng chung ở ReturnMetrics và DashboardScreen (navDelta).
export function signColorClass(value: number): string {
  if (value === 0) return "text-foreground";
  return value > 0 ? "text-gain" : "text-destructive";
}
