"use client";

import type { BondIssuerType } from "@prisma/client";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Alert } from "@/components/Alert";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { BondTermsFields } from "@/features/holdings/components/BondTermsFields";
import { ROUTES } from "@/lib/routes";

import { saveBondTerms } from "../../actions";

type BondTermsFormProps = {
  holding: { id: string; symbol: string; name: string | null };
  // Giá trị đang lưu (dạng chuỗi form), "" cho ô chưa nhập. Vắng cả cụm =
  // vị thế chưa từng nhập điều khoản (lối vào từ màn chặn 7g).
  defaults: {
    issuerType: BondIssuerType;
    parValue: string;
    couponRatePercent: string;
    couponFrequencyMonths: string;
    firstCouponDate: string;
    maturityDate: string;
  };
  closeHref: string;
};

// Màn nhập/sửa điều khoản trái phiếu (mockup Phase 7 Screens 7a). Giữ toàn bộ
// state của `BondTermsFields` (Presentational thuần, mọi field controlled) và
// gọi Server Action `saveBondTerms` — cùng pattern TransactionForm: form tự
// bridge FormData -> payload, route chỉ lo lấy dữ liệu prefill.
//
// Là route riêng chứ không nhét vào form sửa vị thế: đây là đích của MỌI chỗ
// báo thiếu điều khoản (BondTermsMissingNotice 7g, link "Sửa điều khoản" trên
// thẻ tóm tắt ở form ghi trái tức), nên cần một URL ổn định.
function BondTermsForm({ holding, defaults, closeHref }: BondTermsFormProps) {
  const router = useRouter();

  const [issuerType, setIssuerType] = useState<BondIssuerType>(
    defaults.issuerType,
  );
  const [parValue, setParValue] = useState(defaults.parValue);
  const [couponRatePercent, setCouponRatePercent] = useState(
    defaults.couponRatePercent,
  );
  const [couponFrequencyMonths, setCouponFrequencyMonths] = useState(
    defaults.couponFrequencyMonths,
  );
  const [firstCouponDate, setFirstCouponDate] = useState(
    defaults.firstCouponDate,
  );
  const [maturityDate, setMaturityDate] = useState(defaults.maturityDate);

  async function submitTerms(
    _prevState: { ok: boolean; error?: string } | null,
  ): Promise<{ ok: boolean; error?: string } | null> {
    // Đọc thẳng từ state (không qua FormData): mọi field ở đây đều controlled,
    // và SegmentedControl/Select không phải input thật nên FormData sẽ thiếu
    // `issuerType` — chính là field quyết định thuế 5% hay 0%.
    const result = await saveBondTerms({
      holdingId: holding.id,
      issuerType,
      parValue,
      couponRatePercent,
      couponFrequencyMonths,
      firstCouponDate,
      maturityDate,
    });

    if (!result.ok) return { ok: false, error: result.error };

    router.push(ROUTES.holdingDetail(holding.id));
    return { ok: true };
  }

  const [state, formAction, isPending] = useActionState(submitTerms, null);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Điều khoản trái phiếu"
        subtitle={`${holding.symbol} · nhập một lần, dùng cho mọi kỳ trái tức`}
        backHref={closeHref}
        variant="close"
      />

      <form action={formAction} className="flex flex-col gap-4.5">
        <BondTermsFields
          issuerType={issuerType}
          onIssuerTypeChange={setIssuerType}
          parValue={parValue}
          onParValueChange={setParValue}
          couponRatePercent={couponRatePercent}
          onCouponRatePercentChange={setCouponRatePercent}
          couponFrequencyMonths={couponFrequencyMonths}
          onCouponFrequencyMonthsChange={setCouponFrequencyMonths}
          firstCouponDate={firstCouponDate}
          onFirstCouponDateChange={setFirstCouponDate}
          maturityDate={maturityDate}
          onMaturityDateChange={setMaturityDate}
          disabled={isPending}
        />

        {state && !state.ok ? (
          <Alert
            variant="error"
            title="Không lưu được điều khoản"
            description={state.error ?? "Thử lại sau ít phút."}
          />
        ) : null}

        <Button
          type="submit"
          // Mệnh giá là ô duy nhất chặn submit — cả cụm coupon bỏ trống được
          // (trái phiếu chiết khấu/zero-coupon), xem BondTermsFields.
          disabled={isPending || parValue.trim() === ""}
          className="h-13 w-full gap-2 rounded-2xl bg-asset-bond text-[14.5px] font-bold text-primary-foreground hover:bg-asset-bond/85"
        >
          <Check className="size-5" />
          {isPending ? "Đang lưu…" : "Lưu điều khoản"}
        </Button>
      </form>
    </div>
  );
}

export { BondTermsForm };
export type { BondTermsFormProps };
