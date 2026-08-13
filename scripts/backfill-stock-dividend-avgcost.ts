// Backfill script — bugfix `avgCost` không dilute qua cổ tức cổ phiếu
// (process/DECISION.md 2026-08-13, process/decisions/dividends.md mục cùng ngày).
//
// TRƯỚC fix, `recordStockDividend()` (features/dividends/actions.ts) và
// `derivePosition()` (lib/cost-basis.ts) đều giữ nguyên `avgCost` khi nhận cổ
// tức cổ phiếu — SAI, phải pha loãng (dilute) theo công thức đóng:
//   avgCost_mới = SL_trước × avgCost_cũ / SL_sau
// Mọi `Holding` từng nhận `Dividend{type: STOCK}` TRƯỚC khi fix này được deploy
// có thể đang giữ cache `avgCost` sai (cao hơn giá trị đúng) — script này tính
// lại `avgCost`/`quantity` ĐÚNG bằng `derivePosition()` (bản đã sửa) và so với
// cache hiện có trên `Holding`.
//
// ⚠️ CẨN TRỌNG KHI CHẠY THẬT: script này ghi thẳng vào `Holding.quantity`/
// `avgCost` của MỌI user có cổ tức cổ phiếu — không phải test giả lập. Mặc
// định LUÔN dry-run (chỉ log ra console, KHÔNG ghi DB). Chỉ ghi khi truyền cờ
// `--apply` tường minh. Trước khi chạy `--apply` lên production: backup DB
// (Neon point-in-time restore luôn có sẵn, nhưng vẫn nên chủ động kiểm tra),
// và đã review kỹ log dry-run trước đó.
//
// Chạy: DATABASE_URL=... npx tsx scripts/backfill-stock-dividend-avgcost.ts [--apply]
// (dry-run mặc định — không truyền --apply)
//
// Dùng import TƯƠNG ĐỐI (không alias `@/*`) cho chính file này — tránh phụ
// thuộc resolve tsconfig paths riêng của tsx khi chạy trực tiếp qua CLI (dù
// tsx thực tế có hỗ trợ `paths` cho các module import CHUYỂN TIẾP bên trong
// `src/`, không phụ thuộc cách file NÀY tự import).
import Decimal from "decimal.js";

import { db } from "../src/lib/db";
import { derivePosition } from "../src/lib/cost-basis";
import type {
  CashflowInputWithEvent,
  StockDividendInput,
} from "../src/lib/cost-basis";
import { persistPosition } from "../src/features/holdings/repository";

const APPLY = process.argv.includes("--apply");

type CandidateHolding = {
  id: string;
  userId: string;
  symbol: string;
  quantity: Decimal;
  avgCost: Decimal;
  cashflows: CashflowInputWithEvent[];
  stockDividends: StockDividendInput[];
};

// Cùng select shape với `positionSourceSelect` (lib/position-trail.ts) —
// KHÔNG tái dùng thẳng hằng số đó ở đây: hằng số đó không có `id`/`userId`/
// `symbol`/`quantity`/`avgCost` (script cần thêm các field này để log/so
// sánh), và tái dùng một `satisfies Prisma.HoldingSelect` object bằng cách
// merge tay dễ lệch type hơn là khai select trực tiếp, tường minh ở một script
// nhỏ, một lần dùng như thế này.
async function findCandidateHoldings(): Promise<CandidateHolding[]> {
  const holdings = await db.holding.findMany({
    where: { dividends: { some: { type: "STOCK" } } },
    select: {
      id: true,
      userId: true,
      symbol: true,
      quantity: true,
      avgCost: true,
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
    },
  });

  return holdings.map((holding) => ({
    id: holding.id,
    userId: holding.userId,
    symbol: holding.symbol,
    quantity: new Decimal(holding.quantity.toString()),
    avgCost: new Decimal(holding.avgCost.toString()),
    cashflows: holding.cashflows.map((cf) => ({
      id: cf.id,
      type: cf.type,
      date: cf.date,
      createdAt: cf.createdAt,
      quantity: new Decimal(cf.quantity.toString()),
      pricePerUnit: new Decimal(cf.pricePerUnit.toString()),
      feeAmount: new Decimal(cf.feeAmount.toString()),
    })),
    // stockQuantity luôn có mặt cho Dividend{type: STOCK} (ràng buộc ghi ở
    // features/dividends/actions.ts) — non-null assertion an toàn ở đây, đã
    // lọc `where: { type: "STOCK" }` ở query.
    stockDividends: holding.dividends.map((dividend) => ({
      id: dividend.id,
      date: dividend.date,
      createdAt: dividend.createdAt,
      quantity: new Decimal(dividend.stockQuantity!.toString()),
    })),
  }));
}

type Mismatch = {
  holding: CandidateHolding;
  correctQuantity: Decimal;
  correctAvgCost: Decimal;
};

async function main() {
  console.log(
    APPLY
      ? "Chế độ: APPLY — sẽ GHI đè avgCost/quantity lệch vào DB."
      : "Chế độ: DRY-RUN (mặc định) — chỉ log, KHÔNG ghi DB. Truyền --apply để ghi thật.",
  );

  const holdings = await findCandidateHoldings();
  console.log(`Quét ${holdings.length} Holding có Dividend{type: STOCK}.`);

  const mismatches: Mismatch[] = [];
  for (const holding of holdings) {
    const correct = derivePosition(holding.cashflows, holding.stockDividends);
    const quantityMatches = correct.quantity.eq(holding.quantity);
    const avgCostMatches = correct.avgCost.eq(holding.avgCost);
    if (quantityMatches && avgCostMatches) continue; // im lặng cho holding không đổi

    mismatches.push({
      holding,
      correctQuantity: correct.quantity,
      correctAvgCost: correct.avgCost,
    });

    console.log(
      `LỆCH holding=${holding.id} symbol=${holding.symbol} userId=${holding.userId}\n` +
        `  quantity: cache=${holding.quantity.toString()} -> đúng=${correct.quantity.toString()}\n` +
        `  avgCost : cache=${holding.avgCost.toString()} -> đúng=${correct.avgCost.toString()}`,
    );
  }

  if (APPLY) {
    for (const mismatch of mismatches) {
      await db.$transaction(async (tx) => {
        await persistPosition(
          mismatch.holding.id,
          {
            quantity: mismatch.correctQuantity,
            avgCost: mismatch.correctAvgCost,
          },
          tx,
        );
      });
    }
  }

  console.log(
    `Tổng kết: quét ${holdings.length} holding, lệch ${mismatches.length} holding, ` +
      (APPLY
        ? `ĐÃ GHI ${mismatches.length} holding.`
        : `DRY-RUN — chưa ghi gì (chạy lại kèm --apply để ghi thật).`),
  );
}

main()
  .catch((err) => {
    console.error("Backfill thất bại:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
