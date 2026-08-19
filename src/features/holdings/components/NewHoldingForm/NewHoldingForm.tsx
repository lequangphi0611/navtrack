"use client";

import { Percent } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";

import { Alert } from "@/components/Alert";
import type { AssetType } from "@/components/AssetTypeBadge";
import { AutoFilledAmountCard } from "@/components/AutoFilledAmountCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoneyNumber, formatQuantityNumber } from "@/lib/format";
import { parseDecimalOrNull } from "@/lib/parse-decimal";
import { holdingDetailAfterTransaction, ROUTES } from "@/lib/routes";

import { createHolding } from "../../actions";
import type { NewPurchaseFeeSettingRows } from "../../types";
import {
  computeAutoFieldPreview,
  feeKeyLabel,
  formatFormulaLabel,
  toGrossValueDecimal,
} from "../TransactionForm/TransactionForm.utils";
import { toAmount } from "./amount";
import { DuplicateHoldingAlert } from "./DuplicateHoldingAlert";
import { ExistingPositionFields } from "./ExistingPositionFields";
import { AssetTypeTiles, FieldHint, FieldLabel } from "./FormFieldPrimitives";
import { NewPurchaseFields } from "./NewPurchaseFields";
import {
  NewHoldingSourceToggle,
  type PositionSource,
} from "./NewHoldingSourceToggle";
import { TotalCostBreakdownCard } from "./TotalCostBreakdownCard";

type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  savedSymbol?: string;
  // Ca trùng mã khi tạo vị thế "Vừa mua hôm nay" (issue #142) — createHolding()
  // trả kèm vị thế đang giữ (đã string hoá Decimal ở biên server) để render
  // DuplicateHoldingAlert thay Alert lỗi thường. `duplicateSymbol` lưu lại mã
  // user đã gõ lúc submit — result của createHolding không có field này
  // (holdingId trỏ tới Holding CŨ đã tồn tại, không phải input vừa gõ), và sau
  // khi action trả về, submitNewHolding không còn quyền truy cập trực tiếp
  // biến `symbol` cục bộ của lần submit đó ở ngoài closure.
  holdingId?: string;
  existingQuantity?: string;
  existingUnit?: string;
  existingAvgCost?: string;
  duplicateSymbol?: string;
} | null;

// Đơn vị theo loại tài sản — đổi loại thì tự chọn đơn vị đầu tiên của loại đó.
// DB không ràng buộc (Holding.unit là String tự do), đây chỉ là gợi ý ở tầng UI.
const UNIT_OPTIONS: Record<AssetType, string[]> = {
  STOCK: ["cổ phần"],
  FUND: ["CCQ"],
  BOND: ["trái phiếu"],
  GOLD: ["chỉ", "lượng"],
};

function defaultUnit(assetType: AssetType): string {
  return UNIT_OPTIONS[assetType][0] ?? "";
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

type NewHoldingFormProps = {
  // Loại tài sản khởi tạo (vd đi từ /nav-chart?type=STOCK bấm "Thêm vị thế").
  // Vắng mặt = giữ nguyên hành vi cũ, mặc định "STOCK". User vẫn tự đổi loại
  // sau khi form đã mount qua AssetTypeTiles như bình thường.
  initialType?: AssetType;
  // Phí mua thật (TRANSACTION_FEE_BUY_<LOẠI>) cho cả 4 AssetType — nhánh "Vừa
  // mua hôm nay" tự chọn theo `assetType` đang chọn tại chỗ (issue #142, xem
  // getNewPurchaseFeeSettingRows() ở queries/holding-transaction-form.ts).
  feeSettingRowsByType: NewPurchaseFeeSettingRows;
};

function NewHoldingForm({
  initialType = "STOCK",
  feeSettingRowsByType,
}: NewHoldingFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [assetType, setAssetType] = useState<AssetType>(initialType);
  const [unit, setUnit] = useState(defaultUnit(initialType));
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [date, setDate] = useState(todayInputValue());
  // Nhánh khai báo — mặc định "EXISTING" bắt buộc (giữ nguyên hành vi cho
  // e2e/pages/new-holding-page.ts đang dựa vào form khai báo lịch sử, issue
  // #140 KHÔNG được đổi mặc định này).
  const [source, setSource] = useState<PositionSource>("EXISTING");
  // Chỉ dùng ở nhánh "Vừa mua hôm nay" để tính hiển thị TotalCostBreakdownCard
  // — đồng bộ với computedAmount thật (feePreview bên dưới) qua onValueChange
  // của AutoFilledAmountCard (xem bugfix component đó, issue #142).
  const [feeAmount, setFeeAmount] = useState("0");

  function changeAssetType(next: AssetType) {
    setAssetType(next);
    setUnit(defaultUnit(next));
  }

  async function submitNewHolding(
    _prevState: FormState,
    formData: FormData,
  ): Promise<FormState> {
    // Tên nút submit ("save"/"save-and-add-another") — KHÔNG liên quan tới
    // `intent` nghiệp vụ (HISTORICAL/NEW_PURCHASE) truyền cho createHolding()
    // bên dưới, trùng tên field FormData thuần cờ sự cố, tách biến cục bộ để
    // khỏi nhầm hai khái niệm.
    const submitAction = formData.get("intent");
    const symbol = String(formData.get("symbol") ?? "");
    // Nhánh UI (NewHoldingSourceToggle) map thẳng sang `intent` nghiệp vụ của
    // schema/action — "Đã có từ trước" khai báo tự do (gộp trùng mã im lặng),
    // "Vừa mua hôm nay" là một giao dịch mua thật (chặn trùng mã, xem
    // createHolding()).
    const holdingIntent = source === "EXISTING" ? "HISTORICAL" : "NEW_PURCHASE";
    const feeAmountRaw = formData.get("feeAmount");

    // Phí/thuế không nhập ở màn khai báo vị thế ban đầu (mockup 2c) — giá vốn
    // bình quân người dùng nhập đã bao gồm; schema default "0". Nhánh "Vừa mua
    // hôm nay" GỬI feeAmount thật (card AutoFilledAmountCard luôn render input
    // ẩn) — feeAmountRaw === null (nhánh EXISTING, không có card phí) giữ
    // nguyên hành vi cũ: không set field, schema tự default "0".
    const result = await createHolding({
      symbol,
      type: formData.get("type"),
      unit: formData.get("unit"),
      name: formData.get("name") || undefined,
      intent: holdingIntent,
      cashflowType: "BUY",
      date: formData.get("date"),
      quantity: formData.get("quantity"),
      pricePerUnit: formData.get("pricePerUnit"),
      feeAmount: feeAmountRaw === null ? undefined : feeAmountRaw,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        fieldErrors: result.fieldErrors,
        holdingId: result.holdingId,
        existingQuantity: result.existingQuantity,
        existingUnit: result.existingUnit,
        existingAvgCost: result.existingAvgCost,
        duplicateSymbol: result.holdingId ? symbol : undefined,
      };
    }

    if (submitAction === "save-and-add-another") {
      formRef.current?.reset();
      setQuantity("");
      setPricePerUnit("");
      setDate(todayInputValue());
      return { ok: true, savedSymbol: symbol };
    }

    router.push(
      holdingDetailAfterTransaction(
        result.data.holdingId,
        result.data.cashflowId,
      ),
    );
    return { ok: true };
  }

  const [state, formAction, isPending] = useActionState(submitNewHolding, null);

  const orderValue = toAmount(quantity, pricePerUnit);
  const feeValue = parseDecimalOrNull(feeAmount)?.toNumber() ?? 0;
  const totalWithFee = orderValue + feeValue;
  const quantityValue = parseDecimalOrNull(quantity)?.toNumber() ?? 0;

  // Phí mua thật (issue #142) — recompute mỗi render từ quantity/pricePerUnit/
  // date/assetType hiện tại, cùng cách TransactionForm tính taxPreview/feePreview
  // (không cần effect: computedAmount chỉ là input của AutoFilledAmountCard,
  // chính card đó tự "đóng băng" một khi user sửa tay).
  const grossValueDecimal = toGrossValueDecimal(quantity, pricePerUnit);
  const feePreview = grossValueDecimal
    ? computeAutoFieldPreview(
        feeSettingRowsByType[assetType],
        new Date(date),
        grossValueDecimal,
      )
    : null;
  const feeStatus: "idle" | "computed" = grossValueDecimal
    ? "computed"
    : "idle";
  const feeComputedAmount = feePreview ? feePreview.amount.toString() : "0";
  const feeFormulaLabel =
    grossValueDecimal && feePreview
      ? formatFormulaLabel(
          grossValueDecimal,
          feePreview,
          feeKeyLabel("BUY", assetType),
        )
      : undefined;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4.5">
      <NewHoldingSourceToggle
        value={source}
        onChange={setSource}
        disabled={isPending}
      />

      <div>
        <FieldLabel>Loại tài sản</FieldLabel>
        <input type="hidden" name="type" value={assetType} />
        <AssetTypeTiles
          value={assetType}
          onChange={changeAssetType}
          disabled={isPending}
        />
      </div>

      <div>
        <FieldLabel>Mã</FieldLabel>
        <Input
          type="text"
          name="symbol"
          placeholder="VD: FPT"
          className="h-11 rounded-xl font-mono font-semibold"
          required
          disabled={isPending}
        />
        <FieldHint>Nhập tay tự do — chưa validate với danh sách sàn.</FieldHint>
      </div>

      <div>
        <FieldLabel>Tên (tuỳ chọn)</FieldLabel>
        <Input
          type="text"
          name="name"
          placeholder="VD: FPT Corp"
          className="h-11 rounded-xl"
          disabled={isPending}
        />
      </div>

      {source === "EXISTING" ? (
        <ExistingPositionFields
          quantity={quantity}
          onQuantityChange={setQuantity}
          unit={unit}
          onUnitChange={setUnit}
          unitOptions={UNIT_OPTIONS[assetType]}
          avgCostPerUnit={pricePerUnit}
          onAvgCostPerUnitChange={setPricePerUnit}
          date={date}
          onDateChange={setDate}
          disabled={isPending}
        />
      ) : (
        <NewPurchaseFields
          quantity={quantity}
          onQuantityChange={setQuantity}
          unit={unit}
          onUnitChange={setUnit}
          unitOptions={UNIT_OPTIONS[assetType]}
          matchedPricePerUnit={pricePerUnit}
          onMatchedPricePerUnitChange={setPricePerUnit}
          date={date}
          onDateChange={setDate}
          disabled={isPending}
          feeCard={
            <AutoFilledAmountCard
              icon={Percent}
              label="Phí giao dịch"
              fieldName="feeAmount"
              computedAmount={feeComputedAmount}
              formulaLabel={feeFormulaLabel}
              status={feeStatus}
              onValueChange={setFeeAmount}
              disabled={isPending}
            />
          }
          totalBreakdown={
            quantity && pricePerUnit ? (
              <TotalCostBreakdownCard
                orderValue={String(orderValue)}
                orderValueFormula={`${quantity} × ${pricePerUnit}`}
                feeAmount={String(feeValue)}
                feePercentLabel=""
                total={String(totalWithFee)}
                avgCostPerUnit={
                  quantityValue > 0 ? String(totalWithFee / quantityValue) : "0"
                }
              />
            ) : null
          }
        />
      )}

      <div className="flex gap-2.5 pt-1">
        <Button
          type="submit"
          name="intent"
          value="save-and-add-another"
          variant="secondary"
          disabled={isPending}
          className="h-12 flex-1 rounded-[13px] text-[13.5px] font-semibold"
        >
          Lưu & thêm mã khác
        </Button>
        <Button
          type="submit"
          name="intent"
          value="save"
          disabled={isPending}
          className="h-12 flex-1 rounded-[13px] text-[13.5px] font-semibold"
        >
          Xong
        </Button>
      </div>

      {state && !state.ok ? (
        state.holdingId ? (
          <DuplicateHoldingAlert
            symbol={state.duplicateSymbol ?? ""}
            existingQuantity={formatQuantityNumber(
              state.existingQuantity ?? "0",
            )}
            existingUnit={state.existingUnit ?? ""}
            existingAvgCost={formatMoneyNumber(state.existingAvgCost ?? "0")}
            addTransactionHref={ROUTES.newTransaction(state.holdingId)}
            onSwitchToExisting={() => setSource("EXISTING")}
          />
        ) : (
          <Alert variant="error" title={state.error ?? "Không lưu được"} />
        )
      ) : null}
      {state?.ok && state.savedSymbol ? (
        <Alert
          variant="info"
          title={`Đã lưu ${state.savedSymbol}`}
          description="Nhập tiếp mã khác bên dưới."
        />
      ) : null}
    </form>
  );
}

export { NewHoldingForm };
export type { NewHoldingFormProps };
