import type { ZodError } from "zod";

export type ActionFailure = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
  // Ca trùng mã khi tạo vị thế "Vừa mua hôm nay" (issue #142) —
  // createHolding() trả kèm vị thế đang giữ để form hiện DuplicateHoldingAlert
  // thay vì lỗi thường. Optional: mọi ActionFailure khác không set các field
  // này. Decimal đã string hoá ở biên server (createHolding), không truyền
  // Decimal thô qua ActionResult.
  holdingId?: string;
  existingQuantity?: string;
  existingUnit?: string;
  existingAvgCost?: string;
};

export type ActionResult<T> = { ok: true; data: T } | ActionFailure;

export function toFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
