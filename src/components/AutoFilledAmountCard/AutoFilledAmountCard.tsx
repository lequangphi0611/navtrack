"use client";

import { Lightbulb, Loader2, Pencil, Sigma } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AutoFilledAmountCardProps = {
  icon: LucideIcon;
  label: string;
  // Tên field submit qua FormData ("taxAmount"/"feeAmount") — giá trị thật
  // (manualValue ?? computedAmount) LUÔN đi qua một <input type="hidden"> riêng
  // do chính component render, tách khỏi input hiển thị (không có `name`) để
  // không đổi contract FormData mà addTransaction/updateTransaction đang đọc
  // (process/phase-5-plan-DRAFT.md mục B1).
  fieldName: string;
  // Decimal đã serialize — giá trị tự tính hiện tại từ form cha (đổi theo
  // quantity/giá/ngày). Component NGỪNG theo giá trị này một khi user gõ tay
  // (đến khi bấm "Đặt lại") — tự thân đây chính là "cờ dirty" của TRƯỜNG NÀY,
  // độc lập với card kia (mỗi instance AutoFilledAmountCard giữ state riêng,
  // nên card Thuế/Phí không vô tình ghi đè lẫn nhau khi field còn lại đổi).
  computedAmount: string;
  // Dòng công thức mờ dưới số, đã compose sẵn bởi form cha (vd
  // "369.000.000 × 0,1% — SALE_TAX_STOCK @ 15/07/2026"). Bỏ trống khi không có
  // công thức để khoe (vd thuế đáo hạn = 0 vì không phải chuyển nhượng — lý do
  // nằm ở reasonBadge/note, không phải phép nhân).
  formulaLabel?: string;
  // Viền/nền nổi bật hơn — dùng cho card Thuế (mockup 5a), card Phí phẳng hơn.
  emphasized?: boolean;
  disabled?: boolean;
  className?: string;
  // Badge lý do ngay dưới số — dùng khi một khoản bằng 0 VÌ LUẬT quy định thế
  // ("Miễn thuế · NĐ 253/2026" ở mockup 7c, "Không phải chuyển nhượng" ở 7e).
  // Quy ước sản phẩm: thuế 0 vẫn hiện thẻ kèm lý do, không ẩn thẻ đi (tiền lệ
  // màn bán vàng Phase 5).
  reasonBadge?: React.ReactNode;
  // Thay câu gợi ý mặc định ở chân thẻ khi ngữ cảnh cần giải thích khác (vd
  // giải thích vì sao đáo hạn không chịu thuế chuyển nhượng 0,1%).
  note?: React.ReactNode;
  // Báo ngược giá trị hiệu lực lên cha MỖI KHI nó đổi (gõ tay hoặc bấm "Đặt
  // lại") — chỉ cần khi cha phải hiển thị con số dẫn xuất từ giá trị này (vd
  // dòng "Thực nhận" trong breakdown Phase 7). Không truyền = giữ nguyên hành
  // vi cũ: state sống trọn trong card, cha không biết gì (Phase 5).
  onValueChange?: (value: string) => void;
  // Có gửi field lên server khi user CHƯA sửa gì không.
  //
  // `true` (mặc định, hành vi Phase 5): luôn gửi. Đúng cho `TransactionForm` —
  // `addTransactionSchema` khai `taxAmount`/`feeAmount` với `.default("0")`,
  // nên field vắng mặt sẽ âm thầm thành 0 thay vì thành "số app tự tính".
  //
  // `false`: chỉ gửi khi user thật sự gõ tay. Dùng khi server tính lại được
  // con số này CHÍNH XÁC HƠN client, và giá trị auto của client có thể lệch —
  // vd thuế trái tức: card tính theo `holding.quantity` (SL hiện tại) còn
  // `recordDividend` tính gross theo `quantityAtDate` (SL tại ngày trả lãi).
  // Luôn gửi ở ca đó khiến `netAmount = gross(theo ngày) − tax(theo hiện tại)`,
  // sai tiền âm thầm khi ghi bù một kỳ cũ (review PR #102). Schema nhận field
  // này phải để `.optional()` (KHÔNG `.default()`) để "vắng mặt" mang đúng
  // nghĩa "dùng số server tự tính".
  submitWhenAuto?: boolean;
  // "computed" (mặc định) = hành vi hiện có (Phase 5): số tự tính hiển thị,
  // sửa tay được, nút "Đặt lại" hoạt động. "idle" = chưa đủ input để tra biểu
  // phí (vd NewPurchaseFields khi thiếu Số lượng/Giá/Ngày) — ẩn bút chì/"Đặt
  // lại", hiện "—" thay vì computedAmount, khoá input. "loading" = đang chờ
  // Server Action tính phí — khung số + công thức thay bằng Skeleton, badge
  // đổi "ĐANG TÍNH", input khoá, ẩn "Đặt lại" (issue #140, mockup vtc1/vte).
  status?: "idle" | "loading" | "computed";
};

const DEFAULT_NOTE: Record<
  NonNullable<AutoFilledAmountCardProps["status"]>,
  string
> = {
  computed:
    "Số tự tính chỉ là gợi ý (giống Giá tự nhập). Sửa tay để khớp đúng số trên sao kê.",
  idle: "cần Số lượng · Giá · Ngày để tra biểu phí",
  loading:
    "Đang tra biểu phí theo loại tài sản + ngày mua — xong sẽ tự điền và vẫn sửa được.",
};

// Card "tự điền, sửa được" dùng chung cho Thuế bán & Phí giao dịch trong
// TransactionForm (process/phase-5-plan-DRAFT.md mục B1) — một component thay
// vì hai khối JSX gần giống nhau. LUÔN có link "Đặt lại" cho cả hai trường hợp
// dùng (quyết định đồng bộ UX, process/DECISION.md 2026-07-18 (5) điểm 2), dù
// mockup 5a/5b chỉ vẽ nút này ở card Thuế.
function AutoFilledAmountCard({
  icon: Icon,
  label,
  fieldName,
  computedAmount,
  formulaLabel,
  emphasized = false,
  disabled = false,
  className,
  reasonBadge,
  note,
  onValueChange,
  submitWhenAuto = true,
  status = "computed",
}: AutoFilledAmountCardProps) {
  const [manualValue, setManualValue] = useState<string | null>(null);
  const value = manualValue ?? computedAmount;
  const isManual = manualValue !== null;
  const isIdle = status === "idle";
  const isLoading = status === "loading";
  const inputDisabled = disabled || isIdle || isLoading;

  // Một chỗ đổi giá trị cho cả ô nhập lẫn nút "Đặt lại" — gọi onValueChange
  // trong handler (không phải lúc render) để cha không bị set state khi đang
  // render, và để cả hai lối đổi giá trị không lệch nhau.
  function changeManualValue(next: string | null) {
    setManualValue(next);
    onValueChange?.(next ?? computedAmount);
  }

  // `changeManualValue` gọi onValueChange trực tiếp trong handler nên luôn
  // thấy bản mới nhất — không cần ref. Effect dưới đây thì khác: nó chỉ chạy
  // lại khi `computedAmount`/`manualValue` đổi, nên nếu đưa thẳng
  // `onValueChange` vào thân effect mà cha lại truyền một hàm mới mỗi render
  // (không bọc `useCallback`, như `NewHoldingForm`/`MaturitySettlementForm`
  // đang làm), effect phải thêm nó vào deps để không "đóng băng" ở bản cũ
  // (stale closure) — nhưng thêm vào deps thì effect chạy lại mỗi render dù
  // computedAmount không đổi. Ref né được cả hai: effect luôn đọc
  // `onValueChangeRef.current` tại thời điểm chạy (không stale) mà deps vẫn
  // chỉ cần đúng giá trị thật sự quyết định "có cần báo lại hay không".
  const onValueChangeRef = useRef(onValueChange);
  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  });

  // `computedAmount` đổi ở cha (vd user sửa Số lượng/Giá/Ngày -> form cha tính
  // lại preview) trong khi CHƯA sửa tay (`manualValue === null`) — trước đây
  // KHÔNG báo lại `onValueChange`, lệch với chính comment của prop này ("báo
  // ngược giá trị hiệu lực lên cha MỖI KHI nó đổi"). Cha dùng `onValueChange`
  // để tính một giá trị dẫn xuất khác (vd TotalCostBreakdownCard ở
  // NewHoldingForm, "Tiền nhận về" ở MaturitySettlementForm) sẽ bị "đứng hình"
  // ở giá trị tính lần đầu/lúc bấm "Đặt lại", không theo kịp giá trị đang hiệu
  // lực thật của chính card — phát hiện khi phí mua tự tính thật ở
  // NewHoldingForm (issue #142) thay cho hardcode "0" cũ.
  useEffect(() => {
    if (manualValue === null) onValueChangeRef.current?.(computedAmount);
  }, [computedAmount, manualValue]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        emphasized
          ? "border-primary/40 bg-linear-to-br from-primary/10 to-card"
          : "border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/6 px-3.75 py-2.75">
        <Icon className="size-4.25 shrink-0 text-primary" />
        <span className="flex-1 text-[13px] font-semibold text-foreground">
          {label}
        </span>
        <Badge className="shrink-0 text-[9px] tracking-wide">
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              ĐANG TÍNH
            </>
          ) : (
            "TỰ ĐIỀN · SỬA ĐƯỢC"
          )}
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-1.5 px-3.75 py-3.25">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5 px-3.75 py-3.25">
            <Input
              type="text"
              inputMode="decimal"
              aria-label={label}
              value={isIdle ? "—" : value}
              onChange={(event) => changeManualValue(event.target.value)}
              disabled={inputDisabled}
              className="h-auto flex-1 border-none bg-transparent px-0 py-0 font-mono text-[22px] font-semibold text-foreground shadow-none tabular-nums focus-visible:ring-0"
            />
            {isIdle ? null : (
              <Pencil className="size-4.5 shrink-0 text-primary" />
            )}
          </div>

          {reasonBadge ? (
            <div className="px-3.75 pb-3">{reasonBadge}</div>
          ) : null}

          {formulaLabel ? (
            <div className="flex items-center gap-1.75 px-3.75 pb-3">
              <Sigma className="size-3.5 shrink-0 text-muted-faint" />
              <span className="font-mono text-[11px] text-muted-faint">
                {formulaLabel}
              </span>
            </div>
          ) : null}
        </>
      )}

      <div className="flex items-start gap-2.25 border-t border-white/5 bg-white/2 px-3.75 py-2.75">
        {isIdle ? (
          <Sigma className="mt-0.5 size-3.75 shrink-0 text-muted-faint" />
        ) : (
          <Lightbulb className="mt-0.5 size-3.75 shrink-0 text-muted-faint" />
        )}
        <span className="flex-1 text-[10.5px] leading-relaxed text-muted-faint">
          {note ?? DEFAULT_NOTE[status]}
        </span>
        {isIdle || isLoading ? null : (
          <button
            type="button"
            onClick={() => changeManualValue(null)}
            disabled={!isManual || disabled}
            className="shrink-0 text-[10.5px] font-bold text-primary disabled:opacity-40"
          >
            Đặt lại
          </button>
        )}
      </div>

      {/* Bỏ hẳn input (không phải để value="") khi cha chọn không gửi số tự
          tính: server phân biệt "user cố ý nhập số này" với "chưa động vào"
          bằng chính sự VẮNG MẶT của field trong FormData. */}
      {isManual || submitWhenAuto ? (
        <input type="hidden" name={fieldName} value={value} />
      ) : null}
    </div>
  );
}

export { AutoFilledAmountCard };
export type { AutoFilledAmountCardProps };
