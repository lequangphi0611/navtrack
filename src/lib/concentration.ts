import Decimal from "decimal.js";

import type { AssetType } from "@/components/AssetTypeBadge";

// docs/domain/04-pricing-and-valuation.md mục "Cảnh báo tập trung" (+ 3 tinh
// chỉnh 2026-07-21: Materiality/Ghi chú tự nhiên/Hysteresis, process/DECISION.md
// 2026-07-21). Hằng số CODE (KHÔNG phải `Setting`) — tham số chống nhiễu hiển
// thị, khác khẩu vị rủi ro của user (đó là CONCENTRATION_WARNING_THRESHOLD).
const MISSING_PRICE_MATERIALITY_PERCENT = 5;
const HYSTERESIS_BUFFER_PERCENT = 3;

// Input tối thiểu cần cho computeConcentration() — caller (wiring, mục 4 kế
// hoạch) tự lọc CHỈ Holding ĐANG MỞ (quantity > 0) trước khi gọi, vị thế đóng
// KHÔNG BAO GIỜ được truyền vào đây (docs/domain/04 "Vị thế đóng: NAV=0,
// không bao giờ bị cảnh báo").
export type ConcentrationInput = {
  id: string;
  type: AssetType;
  // null = MISSING_PRICE (còn mở nhưng không định giá được) — KHÔNG bao giờ
  // suy diễn NAV = 0 cho ca này (docs/domain/04 "Thiếu giá").
  nav: Decimal | null;
  totalCostBasis: Decimal;
  // Holding.concentrationWarningActive ở lần tính GẦN NHẤT — cần cho
  // hysteresis (buffer 3 điểm %, xem bên dưới).
  previouslyWarned: boolean;
};

// 4 biến thể badge (khớp phác thảo `process/UI_phase_6.md` mục 6, Props của
// `ConcentrationBadge` — component Presentational của design-implementer).
// Khai domain type ở ĐÂY (lib/, không phải components/) vì đây là kết quả TÍNH
// TOÁN thuần, ConcentrationBadge (component) sẽ import type ngược lại — cùng
// tiền lệ `HoldingValuation` (lib/valuation.ts) được `HoldingDetailScreen`
// import ngược.
export type ConcentrationBadgeState =
  | { kind: "NORMAL"; percent: number }
  | { kind: "NATURAL_CONCENTRATION"; percent: number; holdingCount: number }
  | { kind: "PARTIAL_NAV"; percent: number; missingPriceSharePercent: number }
  | { kind: "SUPPRESSED"; missingPriceSharePercent: number };

export type ConcentrationResult = {
  // % vốn (costBasis) của các Holding MISSING_PRICE trên tổng NAV(có giá) +
  // costBasis(thiếu giá) — 0 khi không có Holding MISSING_PRICE nào (không
  // NaN/Infinity khi mẫu số = 0, xem computeConcentration()).
  missingPriceSharePercent: number;
  // true khi missingPriceSharePercent > 5% — treo cảnh báo TOÀN DANH MỤC
  // (mọi Holding có giá đều nhận badge SUPPRESSED, không phải chỉ mã vượt
  // ngưỡng — docs/domain/04, digest `process/UI_phase_6.md` mục 6 biến thể 4:
  // "áp dụng cho MỌI Holding, biến thể toàn cục").
  suppressed: boolean;
  // true khi 100/n > threshold (n = số Holding mở có giá) — mọi badge ĐÃ BẬT
  // (không tự tạo badge mới cho Holding dưới ngưỡng, process/DECISION.md
  // 2026-07-21 mục (3)) kèm thêm ghi chú "tự nhiên do ít mã".
  naturalConcentrationNote: boolean;
  // Theo Holding.id — null = không có badge (dưới ngưỡng, hoặc MISSING_PRICE
  // tự thân không tính được cho chính nó).
  results: Map<string, ConcentrationBadgeState | null>;
  // Trạng thái "đang bật" (KHÔNG PHẢI badge đang HIỂN THỊ) theo Holding.id —
  // dùng để ghi đè Holding.concentrationWarningActive (update-on-read, xem
  // getConcentrationBadges() ở lib/portfolio-valuation.ts hoặc file wiring
  // riêng). Khi `suppressed=true`, GIỮ NGUYÊN previouslyWarned (không đổi) —
  // mẫu số không đáng tin trong lúc suppress nên không nên rút ra kết luận bật
  // /tắt mới, tránh hysteresis "nhảy" theo dữ liệu tạm thời không đáng tin.
  warnedNow: Map<string, boolean>;
};

function isValued(
  holding: ConcentrationInput,
): holding is ConcentrationInput & { nav: Decimal } {
  return holding.nav !== null;
}

// Bật khi percent > threshold; MỘT KHI đã bật (previouslyWarned), giữ nguyên
// bật cho tới khi percent <= threshold - buffer (docs/domain/04 "Hysteresis").
function resolveWarned(
  percent: number,
  thresholdPercent: number,
  previouslyWarned: boolean,
): boolean {
  if (percent > thresholdPercent) return true;
  if (
    previouslyWarned &&
    percent > thresholdPercent - HYSTERESIS_BUFFER_PERCENT
  ) {
    return true;
  }
  return false;
}

// Pure, unit-testable — docs/domain/04-pricing-and-valuation.md mục "Cảnh báo
// tập trung" (+ 3 tinh chỉnh 2026-07-21). KHÔNG đọc DB/session — caller
// (wiring) chịu trách nhiệm lọc holdings ĐANG MỞ + valuate trước khi gọi.
export function computeConcentration(
  holdings: ConcentrationInput[],
  thresholdPercent: number,
): ConcentrationResult {
  const valued = holdings.filter(isValued);
  const missingPriced = holdings.filter((h) => h.nav === null);

  const navSum = valued.reduce((sum, h) => sum.plus(h.nav), new Decimal(0));
  const missingCostSum = missingPriced.reduce(
    (sum, h) => sum.plus(h.totalCostBasis),
    new Decimal(0),
  );

  const missingDenominator = navSum.plus(missingCostSum);
  const missingPriceSharePercent = missingDenominator.isZero()
    ? 0
    : missingCostSum.div(missingDenominator).mul(100).toNumber();

  const suppressed =
    missingPriceSharePercent > MISSING_PRICE_MATERIALITY_PERCENT;

  const results = new Map<string, ConcentrationBadgeState | null>();
  const warnedNow = new Map<string, boolean>();

  // MISSING_PRICE tự thân KHÔNG BAO GIỜ nhận badge (không suy diễn NAV/%
  // cho chính mã đó) — giữ nguyên trạng thái hysteresis trước đó (không đủ
  // thông tin để kết luận bật/tắt).
  for (const holding of missingPriced) {
    results.set(holding.id, null);
    warnedNow.set(holding.id, holding.previouslyWarned);
  }

  if (suppressed) {
    // Treo cảnh báo TOÀN DANH MỤC — mẫu số quá khuyết để kết luận, áp dụng
    // cho MỌI Holding có giá (không chỉ mã đang vượt ngưỡng). Giữ nguyên
    // trạng thái hysteresis (không đổi previouslyWarned khi dữ liệu không
    // đáng tin).
    for (const holding of valued) {
      results.set(holding.id, {
        kind: "SUPPRESSED",
        missingPriceSharePercent,
      });
      warnedNow.set(holding.id, holding.previouslyWarned);
    }
    return {
      missingPriceSharePercent,
      suppressed: true,
      naturalConcentrationNote: false,
      results,
      warnedNow,
    };
  }

  const n = valued.length;
  const naturalConcentrationNote = n > 0 && 100 / n > thresholdPercent;

  for (const holding of valued) {
    const percent = navSum.isZero()
      ? 0
      : holding.nav.div(navSum).mul(100).toNumber();

    const warned = resolveWarned(
      percent,
      thresholdPercent,
      holding.previouslyWarned,
    );
    warnedNow.set(holding.id, warned);

    if (!warned) {
      results.set(holding.id, null);
      continue;
    }

    if (missingPriceSharePercent > 0) {
      results.set(holding.id, {
        kind: "PARTIAL_NAV",
        percent,
        missingPriceSharePercent,
      });
    } else if (naturalConcentrationNote) {
      results.set(holding.id, {
        kind: "NATURAL_CONCENTRATION",
        percent,
        holdingCount: n,
      });
    } else {
      results.set(holding.id, { kind: "NORMAL", percent });
    }
  }

  return {
    missingPriceSharePercent,
    suppressed: false,
    naturalConcentrationNote,
    results,
    warnedNow,
  };
}
