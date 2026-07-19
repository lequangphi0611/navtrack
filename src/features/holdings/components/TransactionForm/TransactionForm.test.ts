import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import type { CashflowRow } from "../../types";
import type { AutoFieldPreview } from "./TransactionForm.utils";
import {
  resolveComputedAmount,
  resolveFormulaLabel,
} from "./TransactionForm.utils";

const PREVIEW: AutoFieldPreview = {
  amount: new Decimal(30000),
  ratePercent: new Decimal(0.1),
  effectiveFrom: new Date("2026-01-01"),
};

const CASHFLOW: CashflowRow = {
  id: "cf-1",
  type: "SELL",
  date: "2026-07-15",
  quantity: "100",
  pricePerUnit: "100000",
  amount: "9970000",
  feeAmount: "30000",
  taxAmount: "10000",
  note: null,
};

describe("resolveFormulaLabel", () => {
  it("shows the saved-value message when editing and nothing changed, ignoring preview state", () => {
    expect(
      resolveFormulaLabel(
        true,
        new Decimal(1000),
        null,
        "SALE_TAX_STOCK",
        "missing input",
        "missing config",
      ),
    ).toBe("Giá trị đã lưu cho giao dịch này — sửa tay nếu cần khớp lại.");
  });

  it("shows the missing-input hint when quantity/price aren't entered yet (grossValue null)", () => {
    expect(
      resolveFormulaLabel(
        false,
        null,
        null,
        "SALE_TAX_STOCK",
        "Nhập đủ số lượng & giá bán để tính thuế",
        "Thiếu cấu hình SALE_TAX_STOCK cho ngày này — nhập tay số thuế.",
      ),
    ).toBe("Nhập đủ số lượng & giá bán để tính thuế");
  });

  // Bug tìm thấy bởi verifier khi kiểm chứng Phase 5: input đã đủ (grossValue
  // có) nhưng KHÔNG có dòng Setting hiệu lực tại ngày giao dịch (vd trước
  // BASELINE_DATE lúc seed) trước đây rơi vào đúng nhánh "chưa nhập đủ" ở
  // trên — sai lý do, đổ lỗi cho user trong khi vấn đề thật là thiếu cấu
  // hình (docs/domain/09-settings.md).
  it("shows an explicit missing-config hint (not the missing-input hint) when input is complete but no Setting row is effective yet", () => {
    expect(
      resolveFormulaLabel(
        false,
        new Decimal(9970000),
        null,
        "SALE_TAX_STOCK",
        "Nhập đủ số lượng & giá bán để tính thuế",
        "Thiếu cấu hình SALE_TAX_STOCK cho ngày này — nhập tay số thuế.",
      ),
    ).toBe("Thiếu cấu hình SALE_TAX_STOCK cho ngày này — nhập tay số thuế.");
  });

  it("formats the real formula label when both input and a matching Setting row are present", () => {
    const label = resolveFormulaLabel(
      false,
      new Decimal(9970000),
      PREVIEW,
      "SALE_TAX_STOCK",
      "missing input",
      "missing config",
    );
    expect(label).toContain("SALE_TAX_STOCK");
    expect(label).not.toBe("missing config");
    expect(label).not.toBe("missing input");
  });
});

describe("resolveComputedAmount", () => {
  it("returns the stored amount when editing and nothing changed", () => {
    expect(resolveComputedAmount(CASHFLOW, true, "taxAmount", PREVIEW)).toBe(
      CASHFLOW.taxAmount,
    );
  });

  it("returns the computed preview amount when a Setting row is effective", () => {
    expect(resolveComputedAmount(null, false, "taxAmount", PREVIEW)).toBe(
      PREVIEW.amount.toString(),
    );
  });

  it('falls back to "0" (still editable, paired with the missing-config label) when no Setting row is effective', () => {
    expect(resolveComputedAmount(null, false, "taxAmount", null)).toBe("0");
  });
});
