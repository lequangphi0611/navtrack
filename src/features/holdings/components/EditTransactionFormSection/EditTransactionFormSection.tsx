import { notFound } from "next/navigation";

import { TransactionForm } from "@/features/holdings/components/TransactionForm";
import {
  getHoldingDetail,
  getTransactionSettingRows,
} from "@/features/holdings/queries";

type EditTransactionFormSectionProps = {
  holdingId: string;
  cashflowId: string;
};

async function EditTransactionFormSection({
  holdingId,
  cashflowId,
}: EditTransactionFormSectionProps) {
  // getTransactionSettingRows() cần assetType, chỉ biết được sau khi fetch
  // holding -> không thể Promise.all thật sự song song với getHoldingDetail
  // (assetType không có sẵn từ đâu khác mà không thêm một round-trip riêng);
  // giữ tuần tự, đơn giản hơn là fetch type 2 lần chỉ để chạy song song.
  const holding = await getHoldingDetail(holdingId);
  const cashflow = holding.cashflows.find((cf) => cf.id === cashflowId);
  // notFound() ở đây chạy trong Suspense nên trả 200 (không phải 404 thật) khi
  // cashflow không tồn tại — đánh đổi có chủ đích để header hiện tức thì; chấp
  // nhận được vì app private/auth-gated, không có crawler/SEO (xem process/DECISION.md).
  if (!cashflow) notFound();

  const settingRows = await getTransactionSettingRows(holding.type);

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <TransactionForm
        mode="edit"
        holdingId={holdingId}
        holding={holding}
        cashflow={cashflow}
        settingRows={settingRows}
      />
    </div>
  );
}

export { EditTransactionFormSection };
export type { EditTransactionFormSectionProps };
