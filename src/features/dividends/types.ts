import type { AssetType } from "@/components/AssetTypeBadge";

// Nguồn sự thật cho state của DividendForm (@/features/dividends/components/DividendForm)
// — component chỉ import + re-export lại, không tự định nghĩa (cùng pattern
// NavOverrideFormState/SnapshotTodayState).
export type DividendFormState =
  | { ok: true; result: DividendRecordedResult }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

// Dữ liệu hiển thị màn "Đã ghi cổ tức" (mockup Phase 4 Screens, 4d) — Server
// Action (#52) tự tính (gross/tax/net hoặc quantity, và tuỳ chọn ảnh hưởng
// XIRR), component chỉ hiển thị lại, KHÔNG tự tính lại lần 2.
export type DividendRecordedResult = {
  symbol: string;
  type: "CASH" | "STOCK";
  percentLabel: string; // "20" — hiển thị "Cổ tức tiền mặt 20%"
  dateLabel: string; // đã format dd/MM/yyyy
  // CASH
  grossAmount?: string;
  taxAmount?: string;
  netAmount?: string;
  // STOCK
  addedQuantity?: string;
  afterQuantity?: string;
  unit?: string;
  // Ảnh hưởng XIRR danh mục trước/sau — optional vì cần tính lại toàn bộ chuỗi
  // dòng tiền (domain logic, ngoài phạm vi design-implementer); vắng mặt = ẩn
  // hẳn dòng "XIRR danh mục" ở khối "Ảnh hưởng lên hiệu suất".
  xirrBeforePercent?: string;
  xirrAfterPercent?: string;
  // Tổng cổ tức (net, CASH) đã nhận từ trước tới nay của riêng Holding này —
  // optional cùng lý do trên (cần truy vấn tổng hợp lịch sử).
  totalDividendReceived?: string;
  // STOCK-only: true khi hệ thống TỰ làm tròn xuống stockQuantity (không phải
  // user tự sửa qua stockQuantityOverride) — xem dividend-math.ts::computeStockDividend.
  wasRounded?: boolean;
  // STOCK-only, chỉ có mặt khi wasRounded=true: số CP thưởng trước làm tròn
  // (rawStockQuantity), để hiển thị so sánh với addedQuantity đã floor.
  rawAddedQuantity?: string;
  // Issue #61: ngày tiền/CP thực về tài khoản, đã format dd/MM/yyyy — chỉ có
  // mặt khi user nhập `paymentDate` (field thuần thông tin, không dùng cho
  // tính toán — xem prisma/schema.prisma::Dividend.paymentDate).
  paymentDateLabel?: string;
  // Issue #61: true khi hệ thống TỰ tạo/ghi đè NavOverride bù pha loãng
  // (recordDividend, chỉ xảy ra khi priceAlreadyReflectsMarket=false VÀ có
  // giá cũ để điều chỉnh). Vắng mặt/false-ish = không hiện khối này.
  navOverrideAdjusted?: boolean;
  // Issue #61: giá trước điều chỉnh — chỉ có mặt khi navOverrideAdjusted=true.
  oldPrice?: string;
  // Issue #61: giá sau điều chỉnh (đã ghi vào NavOverride tại `date`) — chỉ
  // có mặt khi navOverrideAdjusted=true.
  newPrice?: string;
  historyHref: string;
  holdingHref: string;
};

// View model dùng chung giữa DividendForm.holding và HoldingSwitcher (current +
// từng option) — Decimal đã serialize thành string ở biên server.
export type DividendHolding = {
  id: string;
  symbol: string;
  name: string | null;
  type: AssetType;
  quantity: string;
  unit: string;
  avgCost: string; // hiển thị ở switcher trigger — "giá vốn {avgCost}"
  marketValue: string; // hiển thị ở dòng trong sheet switcher — "{quantity} · {marketValue}"
};
