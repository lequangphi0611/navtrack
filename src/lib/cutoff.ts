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

// Cuối ngày theo local time (23:59:59.999) — Cashflow.date là DateTime (không
// phải @db.Date), có thể mang giờ khác 0h tùy form nhập, nên cutoff phải chốt
// ở cuối ngày để không bỏ sót dòng tiền phát sinh cùng ngày với mốc chốt.
function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function endOfMonth(now: Date): Date {
  // Ngày 0 của tháng sau = ngày cuối cùng của tháng hiện tại (Date tự tràn).
  return endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function endOfYear(now: Date): Date {
  return endOfDay(new Date(now.getFullYear(), 11, 31));
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
