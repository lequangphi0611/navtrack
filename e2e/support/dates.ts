// Ngày tương đối so với "bây giờ" (không hardcode năm cụ thể) — tránh spec vỡ
// khi chạy ở thời điểm khác ngày hiện tại lúc viết test.
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// yyyy-MM-dd theo field LOCAL của Date (getFullYear/getMonth/getDate) — KHÁC
// isoDate() ở trên vốn qua toISOString() (UTC): ở timezone dương (vd
// Asia/Ho_Chi_Minh/Bangkok UTC+7), "local midnight" của daysAgo() convert
// sang UTC có thể lùi về NGÀY HÔM TRƯỚC nếu code chạy gần đầu ngày local, làm
// isoDate() trả sai ngày. Cần bản LOCAL này khi phải khớp CHÍNH XÁC ô ngày
// trên UI thật (react-day-picker gắn `data-day` theo field local y hệt cách
// tính ở đây — xem date-picker.tsx::toDateValue, CalendarDay.js::isoDate) —
// dùng cho selectDateOnCalendar() (./date-picker.ts), không thay isoDate() ở
// những chỗ chỉ cần string gửi server (buffer nhiều ngày giữa các mốc đủ hấp
// thụ lệch giờ, xem comment trong spec dùng).
export function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
