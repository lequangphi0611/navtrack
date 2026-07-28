import { DividendHistoryList } from "@/features/dividends/components/DividendHistoryList";
import { CashflowTimeline } from "@/features/holdings/components/CashflowTimeline";
import { OverdueMaturityCallout } from "@/features/holdings/components/OverdueMaturityCallout";
import { OverdueMaturityCard } from "@/features/holdings/components/OverdueMaturityCard";

// Gom các mảnh còn lại của Phase 7 vào một trang để soi một lượt:
// 7h (cảnh báo quá đáo hạn), 7d (lịch sử 3 loại), và dòng MATURITY trong
// timeline dòng tiền. Số liệu theo process/UI_phase_7.md mục "Sample data".
export default function OverdueMaturityPreview() {
  return (
    <div className="flex flex-wrap items-start gap-8">
      <div className="flex w-full max-w-md flex-col gap-3">
        <div className="font-mono text-[11px] tracking-wide text-muted-faint uppercase">
          7h · Quá đáo hạn chưa tất toán
        </div>
        <OverdueMaturityCallout count={1} />
        <OverdueMaturityCard
          symbol="TCB2528"
          maturityDateLabel="15/01/2029"
          lateDays={12}
          positionValue="200000000"
          valueNote="2 TP × mệnh giá"
          settleHref="#"
          recordCouponHref="#"
        />
      </div>

      <div className="flex w-full max-w-md flex-col gap-3">
        <div className="font-mono text-[11px] tracking-wide text-muted-faint uppercase">
          7d · Lịch sử cổ tức &amp; trái tức
        </div>
        <DividendHistoryList
          summary={{
            cashNetTotal: "15200000",
            cashCount: 1,
            stockAddedQuantityTotal: "1043",
            stockCount: 1,
            unit: "cổ phần",
            bondCouponNetTotal: "17550000",
            bondCouponCount: 2,
          }}
          rows={[
            {
              id: "d1",
              type: "BOND_COUPON",
              percentLabel: "9",
              date: "15/07/2026",
              grossAmount: "9000000",
              taxAmount: "450000",
              netAmount: "8550000",
              couponRatePercentApplied: "9",
              couponFrequencyMonths: 6,
              isNew: true,
            },
            {
              id: "d2",
              type: "BOND_COUPON",
              percentLabel: "9",
              date: "15/07/2026",
              grossAmount: "9000000",
              taxAmount: "0",
              netAmount: "9000000",
              couponRatePercentApplied: "9",
              couponFrequencyMonths: 6,
              isTaxExempt: true,
            },
            {
              id: "d3",
              type: "CASH",
              percentLabel: "20",
              date: "14/07/2026",
              grossAmount: "16000000",
              taxAmount: "800000",
              netAmount: "15200000",
            },
            {
              id: "d4",
              type: "STOCK",
              percentLabel: "15",
              date: "20/06/2025",
              unit: "cổ phần",
              quantityBefore: "6957",
              quantityAfter: "8000",
              addedQuantity: "1043",
            },
          ]}
          newDividendHref="#"
        />
      </div>

      <div className="flex w-full max-w-md flex-col gap-3">
        <div className="font-mono text-[11px] tracking-wide text-muted-faint uppercase">
          Dòng tiền · MATURITY khác SELL
        </div>
        <CashflowTimeline
          rows={[
            {
              id: "c1",
              kind: "BUY",
              label: "Mua 2 trái phiếu",
              dateNote: "15/01/2026 · giá 92.000.000",
              amount: "-184000000",
            },
            {
              id: "c2",
              kind: "DIVIDEND",
              label: "Trái tức kỳ 1",
              dateNote: "15/07/2026 · sau thuế",
              amount: "8550000",
            },
            {
              id: "c3",
              kind: "MATURITY",
              label: "Đáo hạn 2 trái phiếu",
              dateNote: "15/01/2029 · nhận lại gốc theo mệnh giá",
              amount: "199200000",
            },
            {
              id: "c4",
              kind: "SELL",
              label: "Bán 1 trái phiếu",
              dateNote: "10/10/2028 · chuyển nhượng, chịu thuế 0,1%",
              amount: "98000000",
            },
          ]}
          footnote="MATURITY (tổ chức phát hành trả lại gốc) hiển thị khác SELL (chuyển nhượng ra thị trường) — cùng là dòng tiền dương nhưng luật thuế khác nhau."
        />
      </div>
    </div>
  );
}
