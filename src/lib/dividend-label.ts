import type { DividendType } from "@prisma/client";
import { assertNever } from "@/lib/assert-never";

// Tên loại cổ tức (chip lọc, dòng hiển thị "Tiền mặt 5%"...) — MỘT nguồn sự
// thật dùng chung cho mọi nơi cần tên ngắn của DividendType, cùng lý do
// cashflowActionLabel() (src/lib/cashflow-label.ts): switch exhaustive thay vì
// mỗi nơi tự khai lại Record.
export function dividendTypeName(type: DividendType): string {
  switch (type) {
    case "CASH":
      return "Tiền mặt";
    case "STOCK":
      return "Cổ phiếu";
    case "BOND_COUPON":
      return "Trái tức";
    default:
      return assertNever(type);
  }
}
