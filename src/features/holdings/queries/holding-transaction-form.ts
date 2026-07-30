import { notFound } from "next/navigation";

import type { TransactionSnapshotBannerProps } from "@/features/holdings/components/TransactionSnapshotBanner";
// Cross-feature import (holdings -> snapshots). Cùng lý do đã chấp nhận cho
// toUiXirr ở ../holding-detail.ts (sub-issue #108, xem comment đầy đủ ở đó):
// getJustRecordedBanner() (thân hàm) gọi getManualSnapshotToday(), trong khi
// snapshots/queries.ts (KHÔNG phải file này) gọi getOpenHoldings() qua barrel
// "@/features/holdings/queries" (thực sống ở queries/holdings-overview.ts) —
// 2 module khác nhau trong feature snapshots/holdings, không có usage nào ở
// top-level module, ES module xử lý an toàn (live binding), không phải
// "true" circular init dependency.
import { getManualSnapshotToday } from "@/features/snapshots/queries";
import { getSession } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import type { SettingKey } from "@/lib/settings";
import { saleTaxKey, transactionFeeKey } from "@/lib/settings";

import { findHoldingForPricing, findSettingRowsByKeys } from "../repository";
import type {
  CashflowRow,
  HoldingSummary,
  TransactionSettingRow,
  TransactionSettingRows,
} from "../types";
import {
  buildTransactionDateNote,
  buildTransactionLabel,
} from "./holding-detail-strings";

// Form giao dịch (add/edit/pricing) + banner "vừa ghi nhận" — cùng nhóm màn
// hình với ../holding-detail.ts (getHoldingDetail), tách file riêng chỉ để
// giữ mỗi file dưới 300 dòng (sub-issue #108).

// Setting rows cho form ghi giao dịch (thuế bán + phí mua/bán, process/phase-5-plan-DRAFT.md
// mục A3) — dùng ở NewTransactionFormSection/EditTransactionFormSection, gọi song song
// (Promise.all) với getHoldingDetail. Trả về đã serialize (client component không nhận
// Decimal/enum thô) — TransactionForm (client) tự pickEffectiveSetting() lại tại ngày
// đang chọn trên form mỗi khi user đổi ngày, không round-trip DB (@/lib/settings-resolution,
// thuần, an toàn bundle client).
export async function getTransactionSettingRows(
  assetType: HoldingSummary["type"],
): Promise<TransactionSettingRows> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const keys: SettingKey[] = [
    saleTaxKey(assetType),
    transactionFeeKey("BUY", assetType),
    transactionFeeKey("SELL", assetType),
  ];

  const rows = await findSettingRowsByKeys(keys);

  const toRows = (key: SettingKey): TransactionSettingRow[] =>
    rows
      .filter((row) => row.key === key)
      .map((row) => ({
        value: row.value,
        valueType: row.valueType,
        effectiveFrom: row.effectiveFrom.toISOString(),
      }));

  return {
    saleTaxRows: toRows(saleTaxKey(assetType)),
    feeBuyRows: toRows(transactionFeeKey("BUY", assetType)),
    feeSellRows: toRows(transactionFeeKey("SELL", assetType)),
  };
}

// Query hẹp riêng cho màn nhập giá tay (NavOverrideForm) — không kéo cashflows
// như getHoldingDetail (màn này không cần lịch sử giao dịch), chỉ cần metadata
// + số lượng/vốn để hiển thị preview NAV.
export async function getHoldingForPricing(holdingId: string): Promise<{
  id: string;
  symbol: string;
  name: string | null;
  type: HoldingSummary["type"];
  unit: string;
  quantity: string;
  totalCostBasis: string;
}> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holding = await findHoldingForPricing(holdingId, session.user.id);
  if (!holding) notFound();

  return {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    unit: holding.unit,
    quantity: holding.quantity.toString(),
    totalCostBasis: holding.quantity.mul(holding.avgCost).toString(),
  };
}

// Props cho TransactionSnapshotBanner (mockup 3d, /holdings/[id]) — hiện khi vừa ghi
// một giao dịch VÀ trigger tự động (holdings/actions.ts gọi freezeManualSnapshot()) đã
// chốt xong snapshot hôm nay. `cashflowId` đến từ query param `?cashflowId=` trên URL
// (không phải cookie — xem lib/routes.ts::holdingDetailAfterTransaction), page.tsx
// KHÔNG tin thẳng query string: hàm này tự verify cashflowId thuộc đúng
// `holding.cashflows` ĐÃ FETCH (không query DB lại) trước khi dựng banner. Sai/không
// tồn tại/chưa có snapshot hôm nay -> trả undefined (ẩn banner, không lỗi).
export async function getJustRecordedBanner(
  holding: { unit: string; cashflows: CashflowRow[] },
  cashflowId: string,
): Promise<TransactionSnapshotBannerProps | undefined> {
  const cashflow = holding.cashflows.find((cf) => cf.id === cashflowId);
  if (!cashflow) return undefined;

  const snapshot = await getManualSnapshotToday();
  if (!snapshot) return undefined;

  return {
    // Cùng cách build label/dateNote với timeline trong getHoldingDetail()
    // (../holding-detail.ts) — "Mua 5.000 cổ phần" / "11/07/2026 · giá 27.300".
    transactionLabel: buildTransactionLabel(
      cashflow.type,
      cashflow.quantity,
      holding.unit,
    ),
    transactionDateNote: buildTransactionDateNote(
      cashflow.date,
      cashflow.pricePerUnit,
    ),
    transactionAmount: cashflow.amount,
    transactionKind: cashflow.type,
    snapshotNavValue: snapshot.value,
    navHistoryHref: ROUTES.snapshots,
  };
}
