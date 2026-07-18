# Phase 5 — UI digest (tiền-triển khai, đọc trước khi planner/design-implementer vào việc)

Digest do `design-fetcher` sinh, kéo từ Claude Design project "Web app design
mobile first" (`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → `Phase 5 Screens.dc.html`,
đủ 6 màn 5a-5f. Cache cục bộ tại
`.claude/design-cache/raw/Phase-5-Screens.dc.html` + `.claude/design-cache/index.json`.

**Đây là digest TIỀN triển khai** (Phase 5 đang ⬜ theo `process/PROCESS.md`)
— khác các file `UI_phase_2/3/4.md` vốn là báo cáo HẬU triển khai của
`design-implementer`. Nội dung dưới đây là quan sát mockup + đối chiếu với
`process/phase-5.md`/`docs/domain/07-tax.md` hiện có, không phải quyết định
đã chốt code — `planner`/`design-implementer` vẫn tự quyết cấu trúc file/route
khi bắt tay vào việc.

## Tóm tắt màn hình

| # | Tên | Nội dung chính |
|---|---|---|
| 5a | Ghi lệnh bán · thuế tự tính | `TransactionForm` (tab Bán) — card "Thuế bán" tự prefill (`369.000` từ `SL × giá × 0,1%`), sửa tay được (icon edit + link "Đặt lại"), breakdown "Số tiền thực nhận về" (giá trị bán − phí − thuế = net), dòng preview "Lãi gộp → sau thuế & phí" |
| 5b | Bán lỗ · vẫn có thuế | Cùng form 5a, giá bán < giá vốn → banner cảnh báo "Bán lỗ vẫn phải nộp thuế" (0,1% trên giá trị bán, không trên lãi) + breakdown "Lãi/lỗ thực nhận" ra số âm |
| 5c | Bán vàng · thuế 0% | Cùng form 5a, mã loại VÀNG → card thuế hiển thị `0 ₫` + badge `SALE_TAX_GOLD = 0`, chú thích "vẫn được seed tường minh, không phải thiếu cấu hình" |
| 5d | Dashboard · lãi/lỗ thực nhận | Card "Lãi/lỗ (thực nhận)" — dòng phụ **tappable** "Chi phí ăn mòn" (icon `water_drop`, số tiền + %) mở sheet 5e; tách riêng 1 hàng 2 cột mới "XIRR (sau thuế)" + **"Vốn đã bỏ ra mua"** (grossInvested hiển thị trực tiếp, không chỉ dùng ngầm làm mẫu số) |
| 5e | Chi phí ăn mòn · chi tiết | Bottom sheet mở từ 5d — tổng `costDragAmount` + %, stacked bar 3 màu, breakdown 3 dòng (Phí giao dịch / Thuế bán / Thuế cổ tức) kèm % đóng góp mỗi nguồn + note giải thích mẫu số `grossInvested` |
| 5f | Sửa lệnh bán · tính lại thuế | Form sửa SELL đã ghi — đổi ngày → banner "thuế được tính lại", card so sánh giá trị cũ (gạch ngang) vs giá trị mới theo `SALE_TAX_STOCK` tại ngày mới, vẫn ghi rõ "sửa tay được", dòng delta net thay đổi |

## Đối chiếu với `process/phase-5.md` hiện tại — điểm cần chú ý

1. **Giải quyết điểm mở "sửa SELL đã ghi" (`docs/domain/07-tax.md` dòng 48,
   `phase-5.md` mục cuối "Công việc cần làm").** Mockup 5f chốt rõ hướng:
   đổi ngày → **tính lại** `taxAmount` theo `SALE_TAX_<loại>` tại ngày mới
   (effective dating), hiển thị giá trị cũ gạch ngang cạnh giá trị mới, nhưng
   trường vẫn **sửa tay được** sau khi tính lại (không khoá). Đây là input
   thật để `planner` chốt quyết định thay vì để ngỏ — nhưng vẫn cần user xác
   nhận bằng lời trước khi ghi vào `process/DECISION.md` (mockup là gợi ý
   thiết kế, không tự động là quyết định nghiệp vụ cuối).

2. **Dashboard đổi cấu trúc rộng hơn mô tả trong `phase-5.md`.** Việc cần
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

3. **"Chi phí ăn mòn" có sheet chi tiết (5e), không chỉ một dòng tĩnh.**
   `phase-5.md` mô tả "dòng phụ nhỏ ... hiển thị `costDragAmount` và
   `costDragPercent`" — không nhắc gì tới việc dòng đó **bấm được để mở sheet
   breakdown theo nguồn** (phí/thuế bán/thuế cổ tức, kèm % đóng góp từng
   phần và stacked bar). Đây là mở rộng phạm vi UI so với tiêu chí hoàn thành
   hiện ghi trong `phase-5.md` — nếu giữ, cần thêm một dòng việc mới
   ("sheet chi tiết chi phí ăn mòn") vào mục "Công việc cần làm"/"Tiêu chí
   hoàn thành"; nếu không muốn làm ở Phase 5, cần quyết định tường minh cắt
   bớt so với mockup (giống cách Phase 4 từng cắt bớt vài chi tiết mockup —
   xem `UI_phase_4.md` mục "Điểm lệch so với plan ban đầu").

4. **Nhãn "thực nhận" khớp đề xuất đang để ngỏ trong `phase-5.md`.**
   `phase-5.md` viết "(cân nhắc đổi nhãn rõ hơn thành 'thực nhận' vì đã trừ cả
   phí, không chỉ thuế)" — mockup 5a/5b/5c/5d dùng nhất quán "thực nhận"/
   "Lãi/lỗ (thực nhận)" ở mọi nơi. Có thể chốt luôn nhãn này thay vì để "cân
   nhắc".

5. **Card thuế có nút "Đặt lại"** (reset về giá trị tự tính, mockup 5a) —
   chi tiết nhỏ chưa được nhắc trong `phase-5.md` nhưng khớp tinh thần
   "giống cơ chế NavOverride" đã ghi. Tham khảo
   `src/features/holdings/components/NavOverrideForm/NavOverrideForm.tsx`
   xem đã có pattern reset tương tự chưa trước khi coi là việc mới.

6. **Không có màn nào cho "đáo hạn trái phiếu"** — khớp quyết định đã chốt
   dời sang Phase 7 (`phase-5.md` mục "Phụ thuộc/ghi chú", `docs/domain/07-tax.md`
   mục "Ca biên"). Mockup không mâu thuẫn điểm này.

## Component/atom có thể tái dùng

- `ReturnMetrics` (`src/components/ReturnMetrics`) — cần sửa hoặc tách (xem
  điểm 2 ở trên) để có chỗ cho dòng "Chi phí ăn mòn" + cột "Vốn đã bỏ ra mua".
- `TransactionForm` (`src/features/holdings/components/TransactionForm`) —
  nơi thêm card "Thuế bán" tự prefill+sửa tay; field `taxAmount` **đã tồn
  tại** trong form hiện tại (`feeAmount`/`taxAmount` đều có sẵn, xem
  `TransactionForm.tsx` dòng ~72-241) — việc chính là đổi từ nhập tay thuần
  sang tự tính + prefill, **ẩn hẳn field khi tab = Mua** (hiện tại có thể
  đang hiện cho cả hai loại — cần `design-implementer` kiểm lại).
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

## Props phác thảo (tham khảo, chưa phải hợp đồng cuối)

```ts
// Mở rộng TransactionForm — card thuế bán tự tính
type SellTaxPreview = {
  amount: string;           // prefill, editable qua input riêng
  ratePercent: string;      // "0,1"
  settingKey: string;       // "SALE_TAX_STOCK" — hiển thị mờ dưới số
  effectiveDateLabel: string; // "15/07/2026" — ngày tra Setting
};

// Dòng phụ Chi phí ăn mòn dưới ReturnMetrics/PnL card
type CostDragSummary = {
  amount: string;   // costDragAmount, đã format
  percent: string;  // costDragPercent, đã format — "0,41"
  detailHref?: string; // nếu giữ sheet 5e, mở qua route/sheet state
};

// Breakdown sheet 5e (nếu giữ trong scope)
type CostDragBreakdownRow = {
  label: string;        // "Phí giao dịch" / "Thuế bán" / "Thuế cổ tức"
  amount: string;
  contributionPercent: string; // % trong tổng chi phí ăn mòn (không phải % vốn)
  sourceNote: string;   // "Phase 1 · mua + bán" / "Phase 5 · 0,1% giá trị bán" ...
};
```

## File nguồn
- `Phase 5 Screens.dc.html` (project `fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) →
  cache `.claude/design-cache/raw/Phase-5-Screens.dc.html`.
