import { TransactionForm } from "@/features/holdings/components/TransactionForm";
import {
  getHoldingDetail,
  getOpenHoldingsForSwitcher,
  getTransactionSettingRows,
} from "@/features/holdings/queries";
import { ROUTES } from "@/lib/routes";

type NewTransactionFormSectionProps = {
  holdingId: string;
};

async function NewTransactionFormSection({
  holdingId,
}: NewTransactionFormSectionProps) {
  // getTransactionSettingRows() cần assetType, chỉ biết được sau khi fetch
  // holding -> không thể Promise.all thật sự song song với getHoldingDetail
  // (assetType không có sẵn từ đâu khác mà không thêm một round-trip riêng);
  // giữ tuần tự, đơn giản hơn là fetch type 2 lần chỉ để chạy song song.
  // getOpenHoldingsForSwitcher() KHÔNG phụ thuộc holding -> chạy song song với
  // getHoldingDetail qua Promise.all (issue #138), thay vì chờ thêm round-trip.
  const [holding, openHoldings] = await Promise.all([
    getHoldingDetail(holdingId),
    getOpenHoldingsForSwitcher(),
  ]);
  const settingRows = await getTransactionSettingRows(holding.type);

  // `current` dựng TRỰC TIẾP từ `holding` (getHoldingDetail), KHÔNG tìm trong
  // openHoldings — mã đang xem có thể đã ĐÓNG (quantity = 0, không nằm trong
  // getOpenHoldingsForSwitcher()) nhưng vẫn ghi được giao dịch BUY để mở lại
  // vị thế; dùng .find() sẽ chặn nhầm luồng đó (khác DividendForm — dividends
  // không có luồng ghi trên vị thế đã đóng).
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <TransactionForm
        key={holdingId}
        mode="create"
        holdingId={holdingId}
        holding={holding}
        settingRows={settingRows}
        switcher={{
          current: {
            id: holding.id,
            symbol: holding.symbol,
            name: holding.name,
            type: holding.type,
            quantity: holding.quantity,
            unit: holding.unit,
            avgCost: holding.avgCost,
            marketValue: holding.valuation?.navValue ?? holding.totalCostBasis,
          },
          options: openHoldings.map((h) => ({
            ...h,
            href: ROUTES.newTransaction(h.id),
            isCurrent: h.id === holdingId,
          })),
          sheetTitle: "Chọn mã giao dịch",
          sheetSubtitlePrefix: "Chỉ vị thế đang mở",
        }}
      />
    </div>
  );
}

export { NewTransactionFormSection };
export type { NewTransactionFormSectionProps };
