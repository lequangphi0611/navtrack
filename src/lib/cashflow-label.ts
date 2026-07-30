// Nhãn hành động "Mua"/"Bán" theo CashflowType (Prisma) — MỘT nguồn sự thật
// dùng chung cho mọi nơi hiển thị (TransactionHistoryList, timeline dòng tiền,
// banner "vừa ghi nhận"...). switch exhaustive (docs/rules/typescript-style.md
// mục "Enum") thay vì ternary nhị phân trần — bắt lỗi biên dịch ngay khi
// CashflowType có giá trị mới, không lặng lẽ rơi vào nhánh sai.
import type { CashflowType } from "@prisma/client";

import { assertNever } from "@/lib/assert-never";

export function cashflowActionLabel(type: CashflowType): string {
  switch (type) {
    case "BUY":
      return "Mua";
    case "SELL":
      return "Bán";
    case "MATURITY":
      return "Đáo hạn";
    default:
      return assertNever(type);
  }
}
