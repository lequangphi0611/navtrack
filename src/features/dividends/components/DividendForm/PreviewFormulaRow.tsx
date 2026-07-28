import { Sigma } from "lucide-react";

type PreviewFormulaRowProps = {
  // Câu chữ công thức khác cấu trúc hẳn theo loại (không chỉ khác số), nên
  // nhận children thay vì Record dữ liệu — xem PercentInputField.
  children: React.ReactNode;
};

// Dòng "icon Sigma + công thức preview" dưới ô nhập %, dùng chung giữa
// CashDividendFields/StockDividendFields.
function PreviewFormulaRow({ children }: PreviewFormulaRowProps) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11.5px] text-muted-faint">
      <Sigma className="size-3.5 shrink-0" />
      {children}
    </div>
  );
}

export { PreviewFormulaRow };
