import { TransactionForm } from "@/features/holdings/components/TransactionForm";
import {
  getHoldingDetail,
  getTransactionSettingRows,
} from "@/features/holdings/queries";

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
  const holding = await getHoldingDetail(holdingId);
  const settingRows = await getTransactionSettingRows(holding.type);

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <TransactionForm
        mode="create"
        holdingId={holdingId}
        holding={holding}
        settingRows={settingRows}
      />
    </div>
  );
}

export { NewTransactionFormSection };
export type { NewTransactionFormSectionProps };
