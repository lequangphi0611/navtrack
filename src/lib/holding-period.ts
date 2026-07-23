// Nhãn thời gian nắm giữ một vị thế ĐÃ ĐÓNG — từ ngày mua ĐẦU TIÊN tới ngày
// bán HẾT cuối cùng (getClosedHoldingsDetail(), features/holdings/queries.ts,
// mục 7 phase-6.md). Pure — tính theo lịch (tháng/ngày dương lịch, KHÔNG phải
// khoảng cách mili-giây/30 quy đổi thô), khớp cách người dùng đọc "14 tháng 6
// ngày" hơn là "440 ngày".
//
// Trả về DẠNG THUẦN "{N} tháng {M} ngày" (không kèm tiền tố như "nắm" — UI tự
// ghép câu tuỳ ngữ cảnh hiển thị, xem process/UI_phase_6.md mục 4/5 — digest
// dùng 2 cách ghép câu khác nhau giữa ClosedHoldingRow ("nắm {N} tháng") và
// ClosedPositionSheet ("{N} tháng {M} ngày"), business layer chỉ cung cấp số
// liệu thô nhất quán).
export function computeHoldingPeriodLabel(
  startDate: Date,
  endDate: Date,
): string {
  let months =
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (endDate.getUTCMonth() - startDate.getUTCMonth());
  let days = endDate.getUTCDate() - startDate.getUTCDate();

  if (days < 0) {
    months -= 1;
    // Số ngày của tháng liền trước endDate (ngày 0 của tháng endDate = ngày
    // cuối tháng trước, theo UTC — không liên quan gì tới timezone hiển thị).
    const daysInPrevMonth = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 0),
    ).getUTCDate();
    days += daysInPrevMonth;
  }

  if (months <= 0 && days <= 0) return "0 ngày";

  const parts: string[] = [];
  if (months > 0) parts.push(`${months} tháng`);
  if (days > 0) parts.push(`${days} ngày`);
  return parts.join(" ");
}
