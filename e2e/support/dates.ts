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
