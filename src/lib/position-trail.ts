import Decimal from "decimal.js";

import { Prisma } from "@prisma/client";
import type { CashflowType, DividendType } from "@prisma/client";
import { assertNever } from "@/lib/assert-never";

// Phát lại lịch sử số lượng nắm giữ gồm CẢ cổ tức cổ phiếu, không chỉ Cashflow
// BUY/SELL (docs/domain/01-assets-and-holdings.md "Số lượng hiện tại" = Σ BUY
// − Σ SELL + Σ dividend STOCK.stockQuantity). Trả về before/after TẠI TỪNG
// event (Map theo id), không chỉ giá trị cuối cùng — cần cho:
// (1) recordDividend: biết SL đang giữ TẠI NGÀY GHI (không phải hôm nay);
// (2) getDividendHistory: suy ngược quantityBefore/After cho từng dòng lịch sử;
// (3) cost-basis.ts::derivePosition(): dùng lại (không tính lại) để tính SL +
// validate bán vượt cho 4 action mua/bán (createHolding/addTransaction/
// updateTransaction/deleteTransaction) và getHoldingDetail — di chuyển ra
// lib/ (issue #59) vì giờ dùng chung ở CẢ features/dividends/ lẫn
// features/holdings/, không còn riêng một feature
// (docs/rules/project-structure.md "chỉ đẩy lên lib/ chung khi thực sự tái
// dùng ở nhiều feature").
export type PositionTrailEvent = {
  id: string;
  date: Date;
  createdAt: Date;
  // BUY: +quantity, SELL/MATURITY: -quantity, Dividend STOCK: +stockQuantity,
  // Dividend CASH/BOND_COUPON: 0 (chỉ giữ chỗ trong dòng thời gian, không đổi SL).
  delta: Decimal;
  // Thứ tự trong CÙNG một ngày, thắng cả `createdAt` — xem SETTLEMENT_RANK.
  // Vắng mặt = DEFAULT_EVENT_RANK (mọi sự kiện thường).
  rank?: number;
};

export type PositionTrailEntry = {
  before: Decimal;
  after: Decimal;
};

// Hạng mặc định của mọi sự kiện vị thế (mua/bán/cổ tức/trái tức) — trùng ngày
// thì tie-break tiếp theo `createdAt` như trước.
export const DEFAULT_EVENT_RANK = 0;

// Cashflow{type: MATURITY} xếp SAU MỌI sự kiện khác cùng ngày (process/phase-7.md
// mục 3, docs/domain/03-dividends.md "Ca biên", issue #101). Trái tức kỳ cuối
// thường trả ĐÚNG ngày đáo hạn; nếu user ghi tất toán trước rồi mới ghi trái
// tức, tie-break theo `createdAt` sẽ đặt MATURITY trước -> "SL đang giữ tại
// ngày trả lãi" đã về 0 -> grossAmount ra 0 đồng, SAI ÂM THẦM (không lỗi, không
// cảnh báo). Tie-break theo BẢN CHẤT sự kiện (lãi phát sinh trên số dư TRƯỚC
// khi tất toán), không theo thứ tự người dùng bấm nút.
export const SETTLEMENT_RANK = 1;

// Sort theo (date, rank, createdAt, id) — khớp tie-break convention đã dùng ở
// features/holdings/actions.ts/queries.ts (orderBy [date asc, createdAt asc, id asc])
// khi trùng ngày, để before/after nhất quán với cách Holding.quantity cache được
// materialize. `rank` chèn TRƯỚC createdAt: đây là quy ước domain (tất toán đáo
// hạn luôn là sự kiện CUỐI trong ngày), phải thắng thứ tự ghi nhận thực tế.
// Tách riêng (không inline trong buildQuantityTimeline) vì lib/realized-pnl.ts
// cũng cần đúng quy ước tiebreak này khi trộn Cashflow + cổ tức cổ phiếu thành
// 1 dòng thời gian.
export function sortByPositionTrailOrder<
  T extends { date: Date; createdAt: Date; id: string; rank?: number },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    const rankDiff =
      (a.rank ?? DEFAULT_EVENT_RANK) - (b.rank ?? DEFAULT_EVENT_RANK);
    if (rankDiff !== 0) return rankDiff;
    const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdDiff !== 0) return createdDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// Hạng của một Cashflow trong dòng thời gian cùng ngày — nguồn DUY NHẤT, dùng
// ở buildPositionEvents() lẫn derivePosition()/computeRealizedGainForHolding()
// (không nơi nào tự so `type === "MATURITY"` để suy hạng). switch exhaustive:
// thêm CashflowType mới mà quên xếp hạng là lỗi compile.
export function cashflowEventRank(type: CashflowType): number {
  switch (type) {
    case "BUY":
    case "SELL":
      return DEFAULT_EVENT_RANK;
    case "MATURITY":
      return SETTLEMENT_RANK;
    default:
      return assertNever(type);
  }
}

export function buildQuantityTimeline(
  events: PositionTrailEvent[],
): Map<string, PositionTrailEntry> {
  const sorted = sortByPositionTrailOrder(events);

  const result = new Map<string, PositionTrailEntry>();
  let quantity = new Decimal(0);
  for (const event of sorted) {
    const before = quantity;
    const after = quantity.plus(event.delta);
    result.set(event.id, { before, after });
    quantity = after;
  }
  return result;
}

// createdAt xa nhất có thể — sự kiện ĐANG XỬ LÝ (chưa lưu DB) luôn xếp SAU
// CÙNG khi trùng ngày với cashflow/dividend đã ghi trước đó. Một nguồn sự thật
// duy nhất dùng cho CẢ candidate cashflow (features/holdings/actions.ts) LẪN
// probe dividend (features/dividends/actions.ts) — trước đây khai 2 lần, 2
// tên khác nhau, ràng nhau bằng comment "cùng pattern X" (Connascence of
// Value, docs/rules/clean-code.md mục 1 — mức nguy hiểm nhất mà trông vô hại
// nhất).
export const PENDING_EVENT_CREATED_AT = new Date(8640000000000000);

// Option $transaction dùng chung cho MỌI action đọc cashflows/dividends để
// derive vị thế rồi ghi persistPosition/insertDividend trong CÙNG transaction
// (createHolding/addTransaction/updateTransaction/deleteTransaction,
// features/holdings/actions.ts + recordDividend, features/dividends/actions.ts)
// — TOCTOU: đọc-để-derive và ghi phải atomic, không có unique constraint nào
// khác bảo vệ đường ghi này (docs/rules/data-prisma.md "Race condition khi
// check-rồi-ghi (TOCTOU)"). Trước đây khai lặp lại `{ isolationLevel:
// Prisma.TransactionIsolationLevel.Serializable }` kèm comment "cùng lý do"
// ở 5 nơi — gộp về một nguồn để đổi isolation level (nếu cần) chỉ sửa một
// chỗ. KHÔNG dùng cho freezeManualSnapshot (features/snapshots/actions.ts) —
// TOCTOU ở đó là check-before-insert theo (holdingId, date, period), lý do
// khác, khai Serializable riêng tại chỗ.
export const POSITION_WRITE_TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

// Quy tắc dấu delta cho Cashflow — nguồn DUY NHẤT (docs/rules/clean-code.md
// mục 1 "Connascence of Algorithm"). BUY cộng, SELL/MATURITY trừ — MATURITY
// (tất toán trái phiếu) hành xử như SELL cho mục đích số lượng đang giữ
// (process/phase-7.md mục 2). Dùng ở derivePosition() (lib/cost-basis.ts) và
// buildPositionEvents() bên dưới — thêm giá trị CashflowType mới mà chưa xử
// lý ở đây là lỗi compile, không phải sai âm thầm.
export function cashflowPositionDelta(cf: {
  type: CashflowType;
  quantity: Decimal;
}): Decimal {
  switch (cf.type) {
    case "BUY":
      return cf.quantity;
    case "SELL":
    case "MATURITY":
      return cf.quantity.neg();
    default:
      return assertNever(cf.type);
  }
}

// Quy tắc dấu delta cho Dividend — chỉ STOCK đổi số lượng đang giữ; CASH/
// BOND_COUPON là dòng tiền/lãi, không đổi SL (delta=0, chỉ giữ chỗ trong dòng
// thời gian để buildQuantityTimeline() đọc before/after tại đúng vị trí thời
// gian của chúng). Thêm BOND_COUPON (Phase 7) KHÔNG cần sửa where clause nào ở
// call site — switch này tự trả 0 cho loại không đổi SL, tránh đúng bug mà
// ternary nhị phân cũ mắc phải (docs/rules/clean-code.md mục 1).
export function dividendPositionDelta(dividend: {
  type: DividendType;
  stockQuantity: Decimal | null;
}): Decimal {
  switch (dividend.type) {
    case "STOCK":
      // Prisma chỉ nullable vì field dùng chung mọi loại dividend — STOCK
      // luôn có giá trị (ràng buộc ở tầng ghi, features/dividends/actions.ts).
      return dividend.stockQuantity!;
    case "CASH":
    case "BOND_COUPON":
      return new Decimal(0);
    default:
      return assertNever(dividend.type);
  }
}

// Cả 2 caller thật (dividends/actions.ts, dividends/queries.ts) đều truyền
// thẳng field Decimal đọc từ repository (Prisma trả Decimal instance cho cột
// Decimal, xem DividendPositionCashflow/DividendHistoryCashflow) — nhận
// Decimal trực tiếp ở đây, không round-trip qua string rồi parse lại.
type RawPositionCashflow = {
  id: string;
  type: CashflowType;
  date: Date;
  createdAt: Date;
  quantity: Decimal;
};

type RawPositionDividend = {
  id: string;
  type: DividendType;
  date: Date;
  createdAt: Date;
  stockQuantity: Decimal | null;
};

export type PositionMarkerInput = {
  id: string;
  date: Date;
  createdAt: Date;
  rank?: number;
};

// Chủ sở hữu DUY NHẤT của việc TRỘN Cashflow + Dividend thành một dòng thời
// gian sự kiện (PositionTrailEvent[]) khi cả hai nguồn cần trộn cùng lúc —
// recordDividend()/getDividendHistory() (features/dividends/) PHẢI gọi hàm
// này, không tự dựng PositionTrailEvent[] bằng tay (đã từng cài lại y hệt quy
// tắc delta ở 2 nơi đó + derivePosition(), docs/rules/clean-code.md mục 1
// "Connascence of Algorithm"). `markers`: sự kiện delta=0 CHỈ để đọc
// before/after tại một mốc (thay PROBE_EVENT_ID tự dựng tay trước đây) — dùng
// khi cần biết SL đang giữ TẠI MỘT NGÀY mà bản thân sự kiện đó chưa tồn tại
// trong DB.
export function buildPositionEvents(input: {
  cashflows: RawPositionCashflow[];
  dividends: RawPositionDividend[];
  markers?: PositionMarkerInput[];
}): PositionTrailEvent[] {
  return [
    ...input.cashflows.map((cf) => ({
      id: cf.id,
      date: cf.date,
      createdAt: cf.createdAt,
      rank: cashflowEventRank(cf.type),
      delta: cashflowPositionDelta({
        type: cf.type,
        quantity: cf.quantity,
      }),
    })),
    ...input.dividends.map((dividend) => ({
      id: dividend.id,
      date: dividend.date,
      createdAt: dividend.createdAt,
      // Mọi loại Dividend giữ hạng mặc định -> luôn đứng TRƯỚC MATURITY cùng
      // ngày (SETTLEMENT_RANK), kể cả khi được ghi sau về mặt thời gian.
      rank: DEFAULT_EVENT_RANK,
      delta: dividendPositionDelta({
        type: dividend.type,
        stockQuantity: dividend.stockQuantity,
      }),
    })),
    ...(input.markers ?? []).map((marker) => ({
      id: marker.id,
      date: marker.date,
      createdAt: marker.createdAt,
      // Marker "sự kiện đang xử lý" mang hạng do caller quyết định: probe ghi
      // trái tức giữ hạng mặc định (đọc SL TRƯỚC tất toán cùng ngày), candidate
      // Cashflow{MATURITY} truyền SETTLEMENT_RANK.
      rank: marker.rank ?? DEFAULT_EVENT_RANK,
      delta: new Decimal(0),
    })),
  ];
}

// Tie-break (date, createdAt, id) dùng CHUNG cho mọi Prisma orderBy cần khớp
// sortByPositionTrailOrder() ở trên khi trùng ngày (đổi thứ tự này = đổi
// avgCost/quantity đã materialize) — trước đây khai lặp lại inline ở 6 chỗ.
export const POSITION_TRAIL_ORDER_BY: Prisma.CashflowOrderByWithRelationInput[] =
  [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }];

// Select shape DUY NHẤT dùng để tính vị thế từ Holding: Cashflow (đủ field
// cho delta + avgCost bình quân di động) + Dividend cổ phiếu (đủ field cho
// delta). Tách rời cashflows/dividends khi đọc là sai (issue #59, Connascence
// of Meaning — docs/rules/clean-code.md mục 1) — khai một lần ở đây để bất
// biến đó thành ràng buộc kiểu, không còn dựa vào comment "// Issue #59" dán
// lại ở từng call site. Dividend cố ý lọc `type: "STOCK"` (khác
// buildPositionEvents() ở trên, cần TẤT CẢ loại dividend) — vị thế chỉ cần
// biết cổ tức cổ phiếu, các call site dùng constant này (4 action ghi giao
// dịch + getHoldingDetail) gọi derivePosition() vốn chỉ nhận dividend đã lọc
// sẵn STOCK.
export const positionSourceSelect = {
  cashflows: {
    select: {
      id: true,
      type: true,
      date: true,
      createdAt: true,
      quantity: true,
      pricePerUnit: true,
      feeAmount: true,
    },
    orderBy: POSITION_TRAIL_ORDER_BY,
  },
  dividends: {
    where: { type: "STOCK" },
    select: {
      id: true,
      date: true,
      createdAt: true,
      stockQuantity: true,
    },
  },
} satisfies Prisma.HoldingSelect;
