import { notFound } from "next/navigation";

import { TransactionForm } from "@/features/holdings/components/TransactionForm";
import {
  getCashflowForEdit,
  getHoldingDetail,
} from "@/features/holdings/queries";

type EditTransactionFormSectionProps = {
  holdingId: string;
  cashflowId: string;
};

async function EditTransactionFormSection({
  holdingId,
  cashflowId,
}: EditTransactionFormSectionProps) {
  // Tra cashflow qua query riêng (getCashflowForEdit), KHÔNG dùng
  // holding.cashflows — field đó giờ chỉ là trang đầu (tối đa 20 dòng, xem
  // getHoldingDetail/getHoldingCashflowPage), sửa giao dịch cũ hơn sẽ không
  // tìm thấy nếu dựa vào đó.
  const [holding, cashflow] = await Promise.all([
    getHoldingDetail(holdingId),
    getCashflowForEdit(holdingId, cashflowId),
  ]);
  // notFound() ở đây chạy trong Suspense nên trả 200 (không phải 404 thật) khi
  // cashflow không tồn tại — đánh đổi có chủ đích để header hiện tức thì; chấp
  // nhận được vì app private/auth-gated, không có crawler/SEO (xem process/DECISION.md).
  if (!cashflow) notFound();

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <TransactionForm
        mode="edit"
        holdingId={holdingId}
        holding={holding}
        cashflow={cashflow}
      />
    </div>
  );
}

export { EditTransactionFormSection };
export type { EditTransactionFormSectionProps };
