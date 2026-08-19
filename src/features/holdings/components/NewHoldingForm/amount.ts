import { parseDecimalOrNull } from "@/lib/parse-decimal";

// Đi qua parseDecimalOrNull() (chuẩn hoá dấu phẩy sẵn bên trong) rồi mới đổi
// ra number — không tự gọi Number()/normalize tay để khỏi lặp lại bug đã sửa.
// Dùng chung cho box "Tổng vốn ban đầu" (ExistingPositionFields) và box
// breakdown "Giá trị lệnh" (nhánh NewPurchaseFields, issue #140).
function toAmount(quantity: string, pricePerUnit: string): number {
  const q = parseDecimalOrNull(quantity)?.toNumber() ?? 0;
  const p = parseDecimalOrNull(pricePerUnit)?.toNumber() ?? 0;
  if (q <= 0 || p <= 0) return 0;
  return q * p;
}

export { toAmount };
