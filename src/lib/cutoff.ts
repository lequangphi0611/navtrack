// Mốc chốt định giá cho XIRR/lãi-lỗ (docs/domain/05-returns-xirr-and-pnl.md
// "Chưa bán vẫn tính được": mốc chọn được là hôm nay / cuối tháng / cuối năm /
// tùy chỉnh). Pure, không đụng DB — chỉ resolve một CutoffSelection thành một
// Date cụ thể (cuối ngày) để queries.ts dùng làm cutoffDate cho
// valuateHoldings/Cashflow/Dividend.
//
// CutoffKey khớp NGUYÊN VĂN union đã có sẵn trong
// src/features/settings/components/CutoffPicker/CutoffPicker.tsx (component
// đó là nguồn sự thật cho UI, ở đây định nghĩa lại để lib/ không phụ thuộc
// ngược vào features/ — hai chỗ phải giữ đồng bộ tay vì TS không share type
// giữa component Presentational và lib domain thuần).
export type CutoffKey = "TODAY" | "END_OF_MONTH" | "END_OF_YEAR";

export type CutoffSelection =
  { key: CutoffKey } | { key: "CUSTOM"; date: Date };

// Nhãn hiển thị dùng chung cho Settings (CutoffPicker) + Dashboard
// (cutoffLabel) — một nguồn sự thật, tránh lệch câu chữ giữa 2 nơi hiển thị
// cùng một mốc chốt.
export const CUTOFF_LABELS: Record<CutoffKey | "CUSTOM", string> = {
  TODAY: "Hôm nay",
  END_OF_MONTH: "Cuối tháng này",
  END_OF_YEAR: "Cuối năm nay",
  CUSTOM: "Tuỳ chỉnh",
};

// "Hôm nay"/"cuối tháng"/"cuối năm" PHẢI neo theo giờ Việt Nam (Asia/Ho_Chi_Minh,
// UTC+7, không có DST) — khớp DATE_FORMATTER ở lib/format.ts. new Date() +
// getFullYear()/getMonth()/getDate()/setHours() đọc theo giờ LOCAL của máy chạy
// code (UTC trên Vercel), sai lệch ngày khi giờ UTC rơi vào khung 17:00–23:59
// (tức 00:00–06:59 ICT của NGÀY HÔM SAU) — đây chính là bug đã sửa ở đây.
const ICT_TIME_ZONE = "Asia/Ho_Chi_Minh";
const ICT_OFFSET_HOURS = 7; // UTC+7 cố định, Việt Nam không có DST.

const ICT_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: ICT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Thành phần năm/tháng (0-index, khớp Date.getMonth())/ngày của một instant,
// CHIẾU theo giờ ICT — dùng Intl.DateTimeFormat (không phải getFullYear() v.v.
// trên chính Date đó) để không phụ thuộc timezone của máy chạy code.
function getIctDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = ICT_DATE_PARTS_FORMATTER.formatToParts(date);
  const value = (type: "year" | "month" | "day"): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: value("year"), month: value("month") - 1, day: value("day") };
}

// Dựng Date instant ứng với 23:59:59.999 GIỜ ICT của đúng ngày dương lịch
// (year/month/day, đã tính theo ICT) — quy đổi sang UTC bằng offset cố định
// (23h ICT − 7h = 16h UTC cùng ngày). Kết quả vẫn là một instant tuyệt đối
// bình thường, so sánh/lte với Prisma hoạt động đúng như trước.
function endOfDayFromIctParts(year: number, month: number, day: number): Date {
  return new Date(
    Date.UTC(year, month, day, 23 - ICT_OFFSET_HOURS, 59, 59, 999),
  );
}

function endOfDay(date: Date): Date {
  const { year, month, day } = getIctDateParts(date);
  return endOfDayFromIctParts(year, month, day);
}

// Instant 00:00:00.000 UTC của đúng ngày dương lịch ICT của `now` — KHÁC
// endOfDay() (dùng để LỌC "nhỏ hơn hoặc bằng cutoffDate", trả 23:59:59.999
// ICT). Dùng làm khóa ghi/đọc Snapshot{period: MANUAL} (features/snapshots) —
// Snapshot.date là TIMESTAMP(3) (KHÔNG @db.Date, khác NavOverride/PriceQuote),
// 2 partial unique index dedup khóa theo GIÁ TRỊ CHÍNH XÁC của cột này nên
// hàm phải trả về đúng CÙNG MỘT Date instant mỗi lần gọi trong cùng 1 ngày
// ICT (idempotent theo ngày) — ổn định độc lập với thời điểm gọi trong ngày.
export function todayIctDateOnly(now: Date = new Date()): Date {
  const { year, month, day } = getIctDateParts(now);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

function endOfMonth(now: Date): Date {
  const { year, month } = getIctDateParts(now);
  // Ngày 0 của tháng sau (UTC, thuần lấy số ngày trong tháng) = ngày cuối cùng
  // của tháng hiện tại (Date tự tràn) — year/month ở đây đã là year/month
  // ĐÚNG theo ICT của `now`, chỉ dùng Date.UTC để tính "tháng có bao nhiêu
  // ngày", không liên quan gì tới việc quy đổi timezone của endOfDayFromIctParts.
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return endOfDayFromIctParts(year, month, lastDay);
}

function endOfYear(now: Date): Date {
  const { year } = getIctDateParts(now);
  return endOfDayFromIctParts(year, 11, 31);
}

// Resolve một lựa chọn mốc chốt thành Date cụ thể. `now` cho phép truyền vào
// để test được (mặc định new Date() khi caller không truyền — dùng cho
// getHoldingDetail khi chưa có UI chọn mốc, xem plan "Ghép dòng tiền giả
// định").
export function resolveCutoffDate(
  selection: CutoffSelection,
  now: Date = new Date(),
): Date {
  switch (selection.key) {
    case "TODAY":
      return endOfDay(now);
    case "END_OF_MONTH":
      return endOfMonth(now);
    case "END_OF_YEAR":
      return endOfYear(now);
    case "CUSTOM":
      return endOfDay(selection.date);
  }
}
