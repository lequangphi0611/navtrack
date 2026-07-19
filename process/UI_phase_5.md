# Phase 5 — UI digest (tiền-triển khai, đọc trước khi planner/design-implementer vào việc)

Digest do `design-fetcher` sinh, kéo từ Claude Design project "Web app design
mobile first" (`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → `Phase 5 Screens.dc.html`,
đủ 6 màn 5a-5f. Cache cục bộ tại
`.claude/design-cache/raw/Phase-5-Screens.dc.html` + `.claude/design-cache/index.json`.

**Cập nhật 2026-07-18:** mockup được orchestrator refetch (mockup gốc vừa
thêm phần "phí giao dịch tự tính" — khớp mục việc `TRANSACTION_FEE_BUY/SELL_<loại>`
đã có sẵn trong `process/phase-5.md`). Digest này được refresh theo bản mới;
thay đổi chính: 5a/5b thêm card **"Phí giao dịch"** tự-điền-sửa-được (cùng
ngôn ngữ UI với card "Thuế bán"), dòng "Đang giữ ... giá vốn ..." thêm chú
thích "(gồm phí mua)", và 5f thêm card **"Phí giao dịch · tính lại"** — nghĩa
là đổi ngày một SELL đã ghi giờ tính lại **cả thuế lẫn phí**, không chỉ thuế
như bản digest trước mô tả. Các phần khác (5c, 5d, 5e) không đổi so với bản
trước, giữ nguyên nội dung.

**Đây là digest TIỀN triển khai** (Phase 5 đang ⬜ theo `process/PROCESS.md`)
— khác các file `UI_phase_2/3/4.md` vốn là báo cáo HẬU triển khai của
`design-implementer`. Nội dung dưới đây là quan sát mockup + đối chiếu với
`process/phase-5.md`/`docs/domain/07-tax.md` hiện có, không phải quyết định
đã chốt code — `planner`/`design-implementer` vẫn tự quyết cấu trúc file/route
khi bắt tay vào việc.

## Tóm tắt màn hình

| # | Tên | Nội dung chính |
|---|---|---|
| 5a | Ghi lệnh bán · thuế tự tính | `TransactionForm` (tab Bán) — card "Thuế bán" tự prefill (`369.000` từ `SL × giá × 0,1%`), sửa tay được (icon edit + link "Đặt lại"); **thêm card "Phí giao dịch"** ngay dưới, cùng ngôn ngữ tự-điền-sửa-được (`1.107.000` từ `giá_trị_bán × 0,3%` — biểu phí TPS · cổ phiếu), không có link "Đặt lại"/note gợi ý riêng như card thuế; dòng "Đang giữ ... giá vốn ..." thêm chú thích nhỏ "(gồm phí mua)"; breakdown "Số tiền thực nhận về" (giá trị bán − phí − thuế = net), dòng preview "Lãi gộp → sau thuế & phí" |
| 5b | Bán lỗ · vẫn có thuế | Cùng form 5a (gồm cả card "Phí giao dịch" tự-điền), giá bán < giá vốn → banner cảnh báo "Bán lỗ vẫn phải nộp thuế" (0,1% trên giá trị bán, không trên lãi) + breakdown "Lãi/lỗ thực nhận" trừ cả phí (0,3%) lẫn thuế, ra số âm |
| 5c | Bán vàng · thuế 0% | Cùng form 5a, mã loại VÀNG → card thuế hiển thị `0 ₫` + badge `SALE_TAX_GOLD = 0`, chú thích "vẫn được seed tường minh, không phải thiếu cấu hình"; mockup không vẽ card phí riêng cho vàng ở màn này (breakdown ghi "Vàng không có phí sàn nên thực nhận = giá trị bán" — ngầm hiểu `TRANSACTION_FEE_SELL_GOLD = 0`, cần xác nhận có vẽ card phí `0 ₫` tương tự card thuế hay ẩn hẳn) |
| 5d | Dashboard · lãi/lỗ thực nhận | Card "Lãi/lỗ (thực nhận)" — dòng phụ **tappable** "Chi phí ăn mòn" (icon `water_drop`, số tiền + %) mở sheet 5e; tách riêng 1 hàng 2 cột mới "XIRR (sau thuế)" + **"Vốn đã bỏ ra mua"** (grossInvested hiển thị trực tiếp, không chỉ dùng ngầm làm mẫu số) |
| 5e | Chi phí ăn mòn · chi tiết | Bottom sheet mở từ 5d — tổng `costDragAmount` + %, stacked bar 3 màu, breakdown 3 dòng (Phí giao dịch / Thuế bán / Thuế cổ tức) kèm % đóng góp mỗi nguồn + note giải thích mẫu số `grossInvested` |
| 5f | Sửa lệnh bán · tính lại thuế & phí | Form sửa SELL đã ghi — đổi ngày → banner đổi text thành **"thuế & phí được tính lại"** (không chỉ thuế như bản digest cũ); card "Thuế bán · tính lại" so sánh giá trị cũ (gạch ngang, kèm % thuế cũ) vs mới (kèm % thuế mới + tên Setting/ngày hiệu lực) theo `SALE_TAX_STOCK`; **thêm card "Phí giao dịch · tính lại"** ngay dưới, cùng cấu trúc so sánh cũ/mới theo `TRANSACTION_FEE_SELL_STOCK`; cả hai field vẫn "sửa tay được" sau khi tính lại; dòng delta net gộp cả 2 thay đổi ("Thuế +184.500 & phí +184.500 → thực nhận giảm còn ...") |

## Đối chiếu với `process/phase-5.md` hiện tại — điểm cần chú ý

1. **Giải quyết điểm mở "sửa SELL đã ghi" (`docs/domain/07-tax.md` dòng 48,
   `phase-5.md` mục cuối "Công việc cần làm").** Mockup 5f chốt rõ hướng:
   đổi ngày → **tính lại** `taxAmount` theo `SALE_TAX_<loại>` tại ngày mới
   (effective dating), hiển thị giá trị cũ gạch ngang cạnh giá trị mới, nhưng
   trường vẫn **sửa tay được** sau khi tính lại (không khoá). Đây là input
   thật để `planner` chốt quyết định thay vì để ngỏ — nhưng vẫn cần user xác
   nhận bằng lời trước khi ghi vào `process/DECISION.md` (mockup là gợi ý
   thiết kế, không tự động là quyết định nghiệp vụ cuối).
   **Cập nhật (bản mockup refetch 2026-07-18): 5f giờ tính lại CẢ `feeAmount`
   lẫn `taxAmount`** khi đổi ngày — card "Phí giao dịch · tính lại" đứng
   ngay dưới card "Thuế bán · tính lại", cùng cấu trúc so sánh cũ/mới theo
   `TRANSACTION_FEE_SELL_<loại>`. `process/phase-5.md` mục "Công việc cần
   làm" (dòng 13) và "Tiêu chí hoàn thành" (dòng 27) hiện **chỉ nhắc
   `taxAmount`** khi mô tả "sửa một SELL đã ghi" — cần bổ sung `feeAmount`
   vào cùng câu đó (logic effective-dating khi sửa ngày phải áp dụng đồng
   thời cho cả hai field, không phải chỉ thuế) trước khi giao việc cho
   `business-implementer`.

2. **Card "Phí giao dịch" trong `TransactionForm` không còn là input nhập
   tay thuần — đổi hẳn sang pattern tự-điền-sửa-được giống card thuế
   (mockup 5a/5b, bản refetch 2026-07-18).** Trước đây digest này (và có thể
   cả cách hiểu ban đầu của "Phí giao dịch tự tính" ở `phase-5.md` dòng 16-17)
   chỉ nói field `feeAmount` "tự prefill" — nhưng mockup cho thấy đây là một
   **card riêng biệt** (không chỉ đổi giá trị mặc định của input có sẵn):
   header + badge "TỰ ĐIỀN · SỬA ĐƯỢC", số tiền lớn + icon edit, dòng công
   thức mờ `giá_trị_bán × 0,3% — biểu phí TPS · cổ phiếu`. Về mặt UI, đây là
   **component mới cần dựng** (hoặc mở rộng cùng component với card thuế
   thành một pattern tái dùng chung — xem gợi ý ở mục "Component/atom" bên
   dưới), không phải chỉ sửa value mặc định của field `feeAmount` đã có.
   Khác card thuế, card phí trong 5a/5b **không có** link "Đặt lại"/note
   "giống NavOverride" — có thể mockup chỉ lược bớt cho gọn, cần
   `design-implementer` xác nhận có cố ý bỏ hay nên đồng bộ đủ 2 card.

3. **Dashboard đổi cấu trúc rộng hơn mô tả trong `phase-5.md`.** Việc cần
   làm hiện ghi "thêm dòng phụ nhỏ dưới card lãi/lỗ (`ReturnMetrics`)" — đúng
   một phần (dòng phụ "Chi phí ăn mòn" đúng là gắn dưới card lãi/lỗ), nhưng
   mockup 5d cho thấy **`ReturnMetrics` (hiện là 2 cột XIRR + PnL cạnh nhau,
   xem `src/components/ReturnMetrics/ReturnMetrics.tsx`) bị tách lại**: PnL
   thành card đứng riêng (full-width, có footer tappable), còn XIRR ghép cột
   với một chỉ số **mới chưa từng có trong domain/props** — "Vốn đã bỏ ra
   mua" (tức `grossInvested` hiển thị trực tiếp thành một stat, không chỉ là
   mẫu số ẩn của `costDragPercent`). Đây là thay đổi cấu trúc component, cần
   `planner` cân nhắc: sửa `ReturnMetricsProps` hiện có hay tách thành
   component mới (mirror cách Phase 3/4 từng tách `SnapshotTodayCard` riêng
   khỏi card tổng quan).

4. **"Chi phí ăn mòn" có sheet chi tiết (5e), không chỉ một dòng tĩnh.**
   `phase-5.md` mô tả "dòng phụ nhỏ ... hiển thị `costDragAmount` và
   `costDragPercent`" — không nhắc gì tới việc dòng đó **bấm được để mở sheet
   breakdown theo nguồn** (phí/thuế bán/thuế cổ tức, kèm % đóng góp từng
   phần và stacked bar). Đây là mở rộng phạm vi UI so với tiêu chí hoàn thành
   hiện ghi trong `phase-5.md` — nếu giữ, cần thêm một dòng việc mới
   ("sheet chi tiết chi phí ăn mòn") vào mục "Công việc cần làm"/"Tiêu chí
   hoàn thành"; nếu không muốn làm ở Phase 5, cần quyết định tường minh cắt
   bớt so với mockup (giống cách Phase 4 từng cắt bớt vài chi tiết mockup —
   xem `UI_phase_4.md` mục "Điểm lệch so với plan ban đầu").

5. **Nhãn "thực nhận" khớp đề xuất đang để ngỏ trong `phase-5.md`.**
   `phase-5.md` viết "(cân nhắc đổi nhãn rõ hơn thành 'thực nhận' vì đã trừ cả
   phí, không chỉ thuế)" — mockup 5a/5b/5c/5d dùng nhất quán "thực nhận"/
   "Lãi/lỗ (thực nhận)" ở mọi nơi. Có thể chốt luôn nhãn này thay vì để "cân
   nhắc".

6. **Card thuế có nút "Đặt lại"** (reset về giá trị tự tính, mockup 5a) —
   chi tiết nhỏ chưa được nhắc trong `phase-5.md` nhưng khớp tinh thần
   "giống cơ chế NavOverride" đã ghi. Tham khảo
   `src/features/holdings/components/NavOverrideForm/NavOverrideForm.tsx`
   xem đã có pattern reset tương tự chưa trước khi coi là việc mới. Lưu ý
   card phí (5a/5b) **không có** nút này trong mockup hiện tại — xem điểm 2.

7. **Không có màn nào cho "đáo hạn trái phiếu"** — khớp quyết định đã chốt
   dời sang Phase 7 (`phase-5.md` mục "Phụ thuộc/ghi chú", `docs/domain/07-tax.md`
   mục "Ca biên"). Mockup không mâu thuẫn điểm này.

## Component/atom có thể tái dùng

- `ReturnMetrics` (`src/components/ReturnMetrics`) — cần sửa hoặc tách (xem
  điểm 2 ở trên) để có chỗ cho dòng "Chi phí ăn mòn" + cột "Vốn đã bỏ ra mua".
- `TransactionForm` (`src/features/holdings/components/TransactionForm`) —
  nơi thêm **hai card** tự-điền-sửa-được: "Thuế bán" (chỉ SELL, ẩn hẳn khi
  tab = Mua) và "Phí giao dịch" (CẢ Mua lẫn Bán, theo `phase-5.md` dòng 17).
  Field `feeAmount`/`taxAmount` **đã tồn tại** trong form hiện tại (xem
  `TransactionForm.tsx` dòng ~72-241) nhưng là input nhập tay thuần — việc
  chính là đổi UI của cả hai field này thành cùng một **pattern card tái
  dùng** (badge "TỰ ĐIỀN · SỬA ĐƯỢC", số lớn + icon edit, công thức mờ dưới
  số) thay vì input trơn; cân nhắc tách một component chung kiểu
  `AutoFilledAmountCard`/`EditablePreviewCard` dùng lại cho cả 2 card thay vì
  copy-paste JSX (xem mockup 5a — 2 card liền kề cùng cấu trúc, chỉ khác icon
  header/badge phụ và có/không có note "Đặt lại").
- `NavOverrideForm` — pattern tham chiếu cho "giá trị tự tính, sửa tay được,
  có nút đặt lại" (mockup 5a/5f dùng cùng ngôn ngữ UI: badge "TỰ ĐIỀN · SỬA
  ĐƯỢC", công thức mờ dưới số, viền accent).
- `Sheet` (đã dùng ở `HoldingSwitcher`/`TransactionHoldingPicker`) — tái dùng
  cho sheet chi tiết 5e nếu giữ trong scope.
- `AssetTypeBadge`, `MoneyValue`, `PercentChange`, `SegmentedControl` (Mua/Bán
  tab) — atom sẵn có, không cần tạo mới.
- Icon mapping mới cần bổ sung vào `docs/rules/ui-ux-design.md` nếu giữ:
  `receipt_long`, `water_drop`, `calculate`, `sync`, `warning` (đã có sẵn?
  kiểm lại trước khi thêm trùng).

## Props thật (đã implement, thay cho phác thảo cũ — cập nhật 2026-07-18 bởi design-implementer)

Digest ban đầu phác thảo `SellTaxPreview`/`TransactionFeePreview`/`CostDragSummary`/
`CostDragBreakdownRow` tách riêng theo field (`ratePercent`, `settingKey`,
`effectiveDateLabel`...) — khi hiện thực, các field này được **compose sẵn
thành 1 string `formulaLabel`/`*SummaryLabel` bởi `TransactionForm`** (caller)
thay vì để `AutoFilledAmountCard` tự ráp từ nhiều field rời — đơn giản hoá
component dùng chung, đổi lại component không tự format được nếu cần tái dùng
ở chỗ khác có ngôn ngữ khác (chấp nhận được, chưa có nhu cầu đó).

```ts
// src/components/AutoFilledAmountCard — card Thuế bán (chỉ SELL) VÀ card Phí
// giao dịch (BUY lẫn SELL) trong TransactionForm — 1 type chung, gộp
// SellTaxPreview/TransactionFeePreview như dự kiến.
type AutoFilledAmountCardProps = {
  icon: LucideIcon;
  label: string; // "Thuế bán" / "Phí giao dịch"
  fieldName: string; // "taxAmount" / "feeAmount" — tên field submit qua FormData
  computedAmount: string; // Decimal đã serialize, tự tính lại mỗi render
  formulaLabel: string; // đã compose sẵn: "369.000.000 ₫ × 0,1% — SALE_TAX_STOCK @ 15/07/2026"
  emphasized?: boolean; // viền/nền nổi bật — dùng cho card Thuế
  disabled?: boolean;
  className?: string;
};
// State nội bộ: manualValue: string | null (null = theo computedAmount).
// LUÔN render link "Đặt lại" (đã chốt process/DECISION.md 2026-07-18 (5) điểm 2
// — không có prop showResetLink nữa, khác phác thảo B1 ban đầu).

// src/features/holdings/components/SellRecomputeCompareCard — card so sánh
// cũ/mới khi sửa ngày một SELL đã ghi (mockup 5f), tách RIÊNG khỏi
// AutoFilledAmountCard (không gộp chung) vì hành vi khác: newAmount LUÔN ghi
// đè input mỗi khi đổi (không "đóng băng" khi user từng sửa tay) — caller ép
// bằng key={date} để remount thay vì tự đồng bộ qua effect.
type SellRecomputeCompareCardProps = {
  icon: LucideIcon;
  label: string; // "Thuế bán · tính lại" / "Phí giao dịch · tính lại"
  fieldName: string;
  oldAmount: string; // props.cashflow.taxAmount/feeAmount — hiển thị gạch ngang
  oldSummaryLabel: string; // "Ngày cũ 10/01/2026 · thuế 0,10%"
  newAmount: string; // giá trị tính lại tại ngày hiện tại
  newSummaryLabel: string; // "Ngày mới 15/07/2026 · thuế 0,15%"
  newDetailNote?: string; // "SALE_TAX_STOCK áp dụng từ 01/03/2026"
  emphasized?: boolean;
  disabled?: boolean;
  className?: string;
};

// src/features/dashboard/components/PnlCostDragCard — card full-width
// "Lãi/lỗ (thực nhận)" + footer "Chi phí ăn mòn" tappable, tự quản lý state
// mở CostDragSheet (không phải sibling riêng ở DashboardScreen như phác thảo
// CostDragSummary.detailHref ban đầu gợi ý).
type PnlCostDragCardProps = {
  pnlValue: string;
  pnlNote?: string;
  costDragAmount: string;
  costDragPercent: number;
  grossInvested: string; // cần để forward vào CostDragSheet (mẫu số + denominator explainer)
  costDragBreakdown: CostDragBreakdownEntry[]; // type thật từ lib/portfolio-valuation.ts
  hidden?: boolean;
};

// src/features/dashboard/components/PortfolioStatsRow — hàng 2 cột "XIRR (sau
// thuế)" + "Vốn đã bỏ ra mua".
type PortfolioStatsRowProps = {
  xirr: XirrResult; // type import từ @/components/ReturnMetrics (KHÔNG import component)
  grossInvested: string;
  hidden?: boolean;
  className?: string;
};

// src/features/dashboard/components/CostDragSheet — sheet chi tiết (mockup 5e),
// controlled từ PnlCostDragCard.
type CostDragSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costDragAmount: string;
  costDragPercent: number;
  grossInvested: string;
  breakdown: CostDragBreakdownEntry[]; // { source: "FEE"|"SALE_TAX"|"DIVIDEND_TAX"; amount: string; contributionPercent: number }[]
  hidden?: boolean;
};
```

## File nguồn
- `Phase 5 Screens.dc.html` (project `fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) →
  cache `.claude/design-cache/raw/Phase-5-Screens.dc.html`.
