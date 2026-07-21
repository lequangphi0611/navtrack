import type { XirrResult } from "@/components/ReturnMetrics";
import type { CutoffOption } from "@/features/settings/components/CutoffPicker";
import { getSession } from "@/lib/auth";
import { CUTOFF_LABELS, type CutoffKey, resolveCutoffDate } from "@/lib/cutoff";
import { db } from "@/lib/db";
import { formatDate, formatSignedPercent } from "@/lib/format";
import { getXirrForCutoff } from "@/lib/portfolio-valuation";
import { ROUTES } from "@/lib/routes";

function formatXirrLabel(xirr: XirrResult): string {
  if (xirr.status !== "OK") return "Chưa tính được";
  return formatSignedPercent(xirr.percentPerYear, { suffix: "/năm" });
}

// 3 lựa chọn mốc chốt cố định cho CutoffPicker (mockup 2e) — mỗi option tự
// tính ngày + XIRR preview của chính nó, không cần biết đang chọn gì
// ("selected" để tô đậm là trách nhiệm riêng của settings/page.tsx đọc từ
// getCutoffSelection()). "Tuỳ chỉnh" (CUSTOM) chưa wiring, không có ở đây.
//
// Dùng getXirrForCutoff() (nhẹ) thay vì getPortfolioValuation() (đầy đủ) —
// preview chỉ đọc .xirr, gọi bản đầy đủ 3 lần sẽ tính dư allocation +
// missingPriceHoldings + priceFreshnessNote (thêm 1 query DB/lần) không dùng
// tới (code review #3).
export async function getCutoffOptions(): Promise<CutoffOption[]> {
  const keys: CutoffKey[] = ["TODAY", "END_OF_MONTH", "END_OF_YEAR"];
  return Promise.all(
    keys.map(async (key) => {
      const cutoffDate = resolveCutoffDate({ key });
      const xirr = await getXirrForCutoff({ key });
      return {
        key,
        label: CUTOFF_LABELS[key],
        date: formatDate(cutoffDate),
        xirrLabel: formatXirrLabel(xirr),
        href: ROUTES.cutoffAction(key),
      };
    }),
  );
}

// Chế độ ẩn số tiền toàn app (mục 8 phase-6.md, process/DECISION.md 2026-07-21
// mục (1)) — cả nút mắt header lẫn toggle Cài đặt đều ghi/đọc CÙNG một giá trị
// `User.hideAmountsByDefault` ngay lập tức (không có tầng "override phiên tạm
// thời" riêng). Mỗi route/screen top-level tự gọi hàm này để lấy giá trị khởi
// tạo cho client wrapper giữ optimistic state local (design-implementer, mục
// 11 phase-6.md) — DB luôn là nguồn sự thật duy nhất, không cần Context toàn
// app.
export async function getHideAmountsByDefault(): Promise<boolean> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { hideAmountsByDefault: true },
  });

  return user?.hideAmountsByDefault ?? false;
}
