# Quyết định — Thuế, phí & chi phí ăn mòn

Phạm vi: `SALE_TAX_<LOẠI>`, `TRANSACTION_FEE_<chiều>_<LOẠI>`, `taxAmount`/`feeAmount` trên `Cashflow`, chi phí ăn mòn (cost drag).
Spec tương ứng: [`docs/domain/07-tax.md`](../../docs/domain/07-tax.md), [`docs/domain/09-settings.md`](../../docs/domain/09-settings.md).

> Thuế lãi trái phiếu + thuế đáo hạn KHÔNG nằm ở đây — xem [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md).

---

## 2026-07-17 (3) — Thảo luận nghiệp vụ Phase 5 (thuế bán): chốt 3 điểm, để ngỏ 2

**Status:** Accepted — cả 2 điểm để ngỏ đã đóng về sau (xem cuối entry)

> ⚠️ Nhãn `2026-07-17 (3)` bị dùng cho **hai** quyết định khác nhau trong file gốc. Entry còn lại (`computeCashDividendPriceAdjustment` trả `null`) nằm ở [`dividends.md`](./dividends.md).

**Thảo luận nghiệp vụ Phase 5 (thuế bán) trước khi implement — chốt 3 điểm, để ngỏ 2 điểm sang lúc implement/Phase 7.**
- Bối cảnh: trao đổi với user (vai chuyên gia tài chính cá nhân) để soát bất cập spec `docs/domain/07-tax.md`/`process/phase-5.md` trước khi giao việc cho `planner`/`dev-cycle`. Phát hiện: (1) `TransactionForm.tsx` từ Phase 1 có sẵn field "Thuế" nhập tay tự do cho **cả BUY lẫn SELL**, nhưng Phase 5 dự định tự động tính thuế — chưa có quyết định UI rõ ràng; (2) VN không đánh thuế TNCN khi mua chứng khoán — field thuế trên BUY vốn dĩ sai bản chất; (3) `SALE_TAX_GOLD` là "điểm còn mở" từ Phase 1 chưa chốt mức; (4) mô hình thuế-khi-bán generic áp cho mọi `SELL` không phân biệt được "đáo hạn trái phiếu" (không phải chuyển nhượng, không chịu thuế) với "bán trước hạn" (chịu thuế 0.1%).
- **Quyết định (1) — SELL: tự tính prefill, KHÔNG khoá field.** `taxAmount` tự resolve từ `SALE_TAX_<loại>` tại ngày bán, hiển thị làm giá trị mặc định trên form, nhưng người dùng sửa tay được — giống cơ chế `NavOverride` (giá trị tự động là gợi ý, không phải nguồn sự thật duy nhất), để khớp đúng số thực trừ trên sao kê CTCK khi có lệch làm tròn.
- **Quyết định (2) — BUY: bỏ hẳn field thuế khỏi form.** `taxAmount` luôn `= 0` cho `Cashflow{type: BUY}`, không có input — đúng bản chất thuế VN (không có thuế khi mua).
- **Quyết định (3) — `SALE_TAX_GOLD` seed `= 0`.** Cá nhân bán vàng miếng/trang sức tại VN không chịu thuế TNCN chuyển nhượng (khác chứng khoán/CCQ). Vẫn phải seed dòng `Setting` tường minh (không được để thiếu — nguyên tắc "thiếu cấu hình → báo lỗi" của `09-settings.md` áp dụng cả khi mức thuế là 0).
- **Để ngỏ (chưa chốt, không tự chọn thay):**
  - Đáo hạn trái phiếu (nhận lại gốc, không phải chuyển nhượng) vs bán trước hạn (chịu `SALE_TAX_BOND` 0.1%) — user hiện chỉ giữ trái phiếu tới đáo hạn, không bán thứ cấp, nên **chưa xử lý ở Phase 5**; dời bàn kỹ sang Phase 7 (đã thêm vào `process/phase-7.md` mục "Phụ thuộc / ghi chú" điểm (4)). → **Đã đóng ở [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md) mục 2026-07-25 (2) điểm (5)** (`CashflowType.MATURITY`).
  - Sửa một SELL đã ghi (đổi ngày/giá) có tính lại `taxAmount` theo ngày mới hay giữ nguyên giá trị cũ (có thể đã bị sửa tay theo (1)) — chưa chốt, cần quyết định lúc implement. → **Đã đóng ở mục 2026-07-18 (2) bên dưới** (tính lại theo ngày mới).
- Docs đã sync: `docs/domain/07-tax.md`, `docs/domain/09-settings.md`, `docs/domain/02-transactions-and-cost-basis.md`, `process/phase-5.md`, `process/phase-7.md`.

---

## 2026-07-17 (4) — Thêm tính năng "Chi phí ăn mòn" (cost drag) vào Phase 5

**Status:** Accepted — mẫu số đã sửa ở [2026-07-17 (6)](#2026-07-17-6--chi-phí-ăn-mòn-đổi-mẫu-số-sang-grossinvested)

**Thêm tính năng mới "Chi phí ăn mòn" (cost drag) vào Phase 5 — tổng thuế + phí luỹ kế, % trên vốn đã bỏ vào.**
- Bối cảnh: tiếp tục thảo luận nghiệp vụ Phase 5, user chọn hiện thực hoá ngay ý tưởng "tổng chi phí thuế + phí đã trả từ đầu" (một trong 3 ý tưởng gợi ý ngoài roadmap) — trả lời câu hỏi gốc của `business-overview.md`: Sheet cũ không cho biết chi phí giao dịch đã ăn vào lợi nhuận bao nhiêu.
- **Phạm vi (đã hỏi user, chọn phương án gộp cả 3 nguồn):** `Σ Cashflow.taxAmount` (thuế bán, Phase 5) + `Σ Cashflow.feeAmount` (phí, có từ Phase 1) + `Σ Dividend.taxAmount` (thuế cổ tức tiền mặt, có từ Phase 4) — không giới hạn riêng trong dữ liệu mới của Phase 5 để con số phản ánh đúng tổng chi phí thật.
- **Mẫu số % (đã hỏi user, chọn "vốn đã bỏ vào"):** ~~tái dùng `totalInvested` đã có sẵn trong `lib/portfolio-valuation.ts`~~ **→ ĐÃ SỬA ở 2026-07-17 (6): dùng `grossInvested` (vốn gộp) thay vì `totalInvested` (vốn ròng), vì vốn ròng vỡ khi đã bán nhiều.** Xem entry (6) bên dưới.
- **Vị trí UI (đã hỏi user, chọn dòng phụ):** một dòng ghi chú nhỏ dưới card lãi/lỗ hiện có (`ReturnMetrics` trong `DashboardScreen.tsx`) — KHÔNG dựng card/tile riêng, giữ phạm vi UI của Phase 5 gọn (chỉ sửa component có sẵn, không thêm component mới). *(Mở rộng thêm sheet chi tiết ở 2026-07-18 (2).)*
- **Không phải chỉ số hiệu suất riêng, không đưa vào XIRR** — XIRR đã tự phản ánh chi phí này qua dòng tiền thực rồi; đây chỉ là phần diễn giải thêm cho lãi/lỗ.
- **Không cần schema/model mới** — mọi field cần đều đã tồn tại (`Cashflow.taxAmount/feeAmount`, `Dividend.taxAmount`), chỉ cần một hàm tổng hợp (business-implementer) + một dòng UI (design-implementer, mở rộng component có sẵn không cần mockup mới lớn). Mẫu số `grossInvested` tính thêm từ chuỗi `Cashflow` (xem (6)).
- Docs đã sync: `docs/domain/07-tax.md` (mục "Chi phí ăn mòn" mới), `docs/domain/05-returns-xirr-and-pnl.md` (cross-reference), `docs/03-roadmap.md` (Phase 5), `docs/business-overview.md` (mục 5), `process/phase-5.md`.

---

## 2026-07-17 (6) — Chi phí ăn mòn đổi mẫu số sang `grossInvested`

**Status:** Accepted — sửa mẫu số sai chốt ở (4)

**Sửa A1: "Chi phí ăn mòn" đổi mẫu số từ `totalInvested` (vốn ròng) sang `grossInvested` (vốn gộp đã triển khai `Σ|BUY.amount|`).**
- Bối cảnh: rà soát lại nghiệp vụ dưới góc nhìn tài chính (thảo luận với user), phát hiện mẫu số `totalInvested` chốt ở (4) là **sai** cho chỉ số chi phí. `totalInvested = -(Σ Cashflow.amount + Σ Dividend.netAmount)` là **vốn ròng** — đã bị phần đã bán + cổ tức rút bớt. Khi user bán nhiều, mẫu số co lại (bán sạch → về ~0 hoặc âm) làm `costDragPercent` phình vô lý (thậm chí âm), dù chi phí thật không đổi. Ví dụ: mua 100tr, bán bớt thu 80tr → vốn ròng ~20tr; chi phí 2tr chia vốn ròng ra 10% (sai), chia vốn gộp 100tr ra 2% (đúng).
- Quyết định: **mẫu số = `grossInvested` = `Σ |Cashflow.amount|` trên các dòng `type = BUY`** (tổng tiền mặt đã chi ra để mua, gồm cả phí mua), tính tới `cutoffDate`. Lý do tài chính: chi phí ăn mòn là chi phí tích luỹ trên **hoạt động giao dịch** → mẫu số phải là vốn đã *rót vào để mua* (chỉ đi lên, không bị bán làm co) chứ không phải vốn *còn lại*. Cân nhắc turnover (Σ|BUY|+Σ|SELL|) nhưng chọn `Σ|BUY|` vì trực giác hơn với user cá nhân ("phí ăn X% số tiền tôi từng rót vào"). `grossInvested = 0` (chưa mua gì) → 0%, không chia 0.
- `totalInvested` (vốn ròng) **vẫn đúng** cho `navDeltaPercent` (lợi suất trên vốn đang làm việc) — không đụng tới chỗ đó; chỉ tách khái niệm cho riêng chi phí ăn mòn.
- Tính năng chưa implement (chỉ mới ở docs) nên đây là sửa spec, không đụng code.
- Docs đã sync: `docs/domain/07-tax.md` (công thức + ví dụ ca bán nhiều), `docs/domain/05-returns-xirr-and-pnl.md` (cross-reference), `docs/03-roadmap.md` (Phase 5), `process/phase-5.md`, cùng ghi chú đính chính ở entry (4).

---

## 2026-07-18 (2) — Đối chiếu mockup Phase 5 thật: chốt 2 điểm mở, mở rộng phạm vi UI

**Status:** Accepted

**Thảo luận đối chiếu mockup Phase 5 thật (`Phase 5 Screens.dc.html`, 6 màn 5a-5f) trước khi implement — chốt 2 điểm còn mở, mở rộng phạm vi UI theo mockup.**
- Bối cảnh: `design-fetcher` kéo mockup Phase 5 lần đầu (chưa có trong cache), sinh digest `process/UI_phase_5.md`. Đối chiếu với `process/phase-5.md`/`docs/domain/07-tax.md` phát hiện mockup giải quyết luôn 1 điểm mở cũ + mở rộng phạm vi 2 chỗ so với mô tả hiện có. Đã hỏi lại user xác nhận từng điểm (không tự chọn thay).
- **Quyết định (1) — sửa một SELL đã ghi: TÍNH LẠI thuế theo ngày mới, không giữ nguyên giá trị cũ.** Đóng điểm mở ghi ở `docs/domain/07-tax.md` (mục "Ca biên") và quyết định 2026-07-17 (3). Đổi **ngày** bán của một SELL đã ghi → form tự resolve lại `SALE_TAX_<loại>` tại ngày mới (effective dating), hiển thị giá trị cũ (gạch ngang) cạnh giá trị mới tính lại + tên `Setting`/ngày hiệu lực áp dụng (mockup 5f). Giá trị tính lại vẫn **sửa tay được** sau đó — không tự khôi phục một giá trị user từng tự sửa tay trước đó (không có cách phân biệt "giá trị cũ do auto-tính" với "giá trị cũ do user tự sửa" trong dữ liệu hiện có).
- **Quyết định (2) — giữ sheet chi tiết "chi phí ăn mòn" trong Phase 5 (mở rộng so với mô tả cũ).** `process/phase-5.md` trước đây chỉ mô tả "một dòng phụ tĩnh" (quyết định 2026-07-17 (4)); mockup 5e vẽ thêm một bottom sheet mở từ dòng phụ đó, breakdown đúng 3 nguồn đã có sẵn trong công thức `costDragAmount` (phí giao dịch / thuế bán / thuế cổ tức) kèm % đóng góp mỗi nguồn + stacked bar. User chọn làm luôn trong Phase 5 thay vì cắt bớt — không cần field/hàm tổng hợp mới, chỉ là một cách trình bày khác của 3 con số đã tính.
- **Quyết định (3) — cấu trúc lại `ReturnMetrics`/card lãi-lỗ Dashboard, ghi rõ trong `phase-5.md` thay vì để design-implementer tự quyết lúc code.** Mockup 5d tách card lãi/lỗ (thực nhận) thành card đứng riêng full-width (có footer "Chi phí ăn mòn" tappable) khỏi hàng 2 cột XIRR; hàng 2 cột mới ghép "XIRR (sau thuế)" với chỉ số **mới** "Vốn đã bỏ ra mua" (hiển thị trực tiếp `grossInvested`, khác `ReturnMetrics` hiện tại là 2 cột XIRR+PnL cạnh nhau). Khác tiền lệ Phase 4 (để design-implementer tự bám mockup, ghi lại ở "điểm lệch so với plan" sau khi xong) — lần này ghi rõ trước trong `phase-5.md` vì đây là thay đổi cấu trúc component có sẵn (`src/components/ReturnMetrics`), không phải component mới.
- **Chốt phụ:** nhãn "Lãi/lỗ (thực nhận)" — bỏ chữ "cân nhắc" trong `phase-5.md` cũ, dùng cố định (mockup nhất quán ở mọi màn 5a-5d).
- Docs đã sync: `docs/domain/07-tax.md` (mục "Ca biên" + "Chi phí ăn mòn"), `process/phase-5.md` (Công việc cần làm + Tiêu chí hoàn thành), `process/UI_phase_5.md` (mới, digest tiền-triển khai).

---

## 2026-07-18 (4) — Phí mua/bán tự tính qua `Setting`; đóng issue #66 (phí mua vào `avgCost`)

**Status:** Accepted

**Bổ sung requirement Phase 5: phí mua/bán tự tính qua `Setting` (mặc định 0.3% theo TPS), tách theo `AssetType` × chiều BUY/SELL — đồng thời đóng issue #66 (gộp phí mua vào `avgCost`).**
- Bối cảnh: `feeAmount` từ Phase 1 tới nay 100% nhập tay tự do (không auto-calc), khác hẳn `taxAmount` đã có cơ chế `SALE_TAX_<loại>` từ Phase 5. User đề xuất áp cùng cơ chế Setting cho phí, mặc định theo biểu phí CTCK đang dùng (TPS, 0.3%), vẫn override được theo từng giao dịch (phòng ca cổ phiếu/công ty khác nhau có phí khác).
- **Quyết định (1) — tách theo từng `AssetType`** (đã hỏi user, không chọn 1 key chung áp mọi loại): `TRANSACTION_FEE_<chiều>_<STOCK/FUND/BOND/GOLD>` — cùng pattern `SALE_TAX_<LOẠI>`. Lý do đề xuất ban đầu (1 key chung, chỉ áp STOCK/FUND) bị bác — user chọn tách đủ 4 loại để nhất quán với thuế, phòng trường hợp sau này BOND/GOLD cũng phát sinh phí qua kênh khác.
- **Quyết định (2) — tách riêng 2 key theo chiều mua/bán** (đã hỏi user, không dùng 1 mức chung cho cả 2 chiều dù hiện tại cùng 0.3%): `TRANSACTION_FEE_BUY_<LOẠI>` / `TRANSACTION_FEE_SELL_<LOẠI>` — tổng **8 key mới**, group `FEE`. Phòng trường hợp CTCK áp biểu phí khác nhau giữa mua và bán sau này.
- **Khác biệt so với thuế (quan trọng):** phí áp dụng cho **CẢ BUY lẫn SELL** (thuế chỉ áp SELL, VN không đánh thuế mua) — vì đây là phí công ty chứng khoán thu trên mỗi lệnh khớp, không phải thuế TNCN do luật quy định. Cùng UX prefill-nhưng-sửa-được như thuế (không khoá field).
- **Quyết định (3) — đóng issue #66 (đang treo từ 2026-07-17 (4)):** chọn **hướng A** (gộp phí mua vào cost basis) trong 2 hướng từng để ngỏ. Lý do chốt ngay đợt này: một khi phí auto-prefill khác `0` cho MỌI giao dịch mua (thay vì thường bị bỏ trống như trước), sai số `avgCost` do bỏ sót phí sẽ lộ rõ và thường xuyên hơn hẳn — không còn hợp lý để treo tiếp. Công thức mới: `giá vốn mới = (SL cũ × giá vốn cũ + (SL mua × giá mua + phí mua)) / (SL cũ + SL mua)`. **Lãi/lỗ đã thực hiện** khi bán chỉ trừ phí/thuế **của lần bán** (phí mua đã nằm trong giá vốn bình quân, tránh trừ trùng).
- **Mức seed:** `STOCK` = `0.3%` (đã xác nhận, theo TPS). `FUND`/`BOND`/`GOLD` **chưa chốt mức** — để ngỏ, seed `0` mặc định (chưa dùng kênh tính phí % cho 2 loại BOND/GOLD hiện tại) theo đúng nguyên tắc "seed tường minh, không thiếu dòng" đã áp cho `SALE_TAX_GOLD`. Cần xác nhận lại lúc implement nếu phát sinh nhu cầu. *(Đã xác nhận ở (5) bên dưới: giữ 0.)*
- **Không cần schema/migration mới** — `Setting` đã là bảng key-value generic, chỉ cần seed thêm dòng.
- Docs đã sync: `docs/domain/07-tax.md` (mục mới "Phí giao dịch (mua & bán)", cập nhật "Mục đích"/"Entity"/"Ca biên"/"Ví dụ"), `docs/domain/02-transactions-and-cost-basis.md` (công thức `avgCost` + "Lãi/lỗ đã thực hiện" + Ví dụ), `docs/domain/09-settings.md` (bảng "Các key hiện có" + Ví dụ), `process/phase-5.md` (Mục tiêu + Công việc cần làm + Tiêu chí hoàn thành + Phụ thuộc/ghi chú), `docs/02-data-model.md` (ghi chú `Setting`).

---

## 2026-07-18 (5) — Chốt 4 điểm còn mở trong plan nháp Phase 5

**Status:** Accepted

**Chốt 4 điểm còn mở trong plan nháp Phase 5 (`process/phase-5-plan-DRAFT.md`) — trước khi implement, chưa code.**
- Bối cảnh: agent `planner` lên plan triển khai Phase 5, để lại 5 điểm cần user xác nhận (1 điểm kỹ thuật thuần do orchestrator tự quyết, không tính). Đi qua từng điểm, user chọn theo đề xuất ở cả 4.
- **(1) `SALE_TAX_BOND` = 0.1%.** Tra cứu thực tế (không suy diễn): Nghị định 253/2026/NĐ-CP + Thông tư 87/2026/TT-BTC (hiệu lực 01/07/2026) quy định thu nhập từ chuyển nhượng trái phiếu chịu thuế TNCN 0.1% trên giá chuyển nhượng mỗi lần — cùng mức và công thức với cổ phiếu/chứng chỉ quỹ, không có mức riêng cho trái phiếu. Seed `SALE_TAX_BOND = 0.1%` cùng `effectiveFrom = BASELINE_DATE`. **Không đổi** quyết định 2026-07-17 về việc đáo hạn trái phiếu (nhận gốc từ tổ chức phát hành) vẫn để ngỏ tới Phase 7 — mức 0.1% này chỉ áp cho SELL (chuyển nhượng thứ cấp), xem `docs/domain/07-tax.md` mục "Ca biên".
- **(2) Nút "Đặt lại" đồng bộ cho cả card Thuế lẫn card Phí trong `TransactionForm`.** Mockup 5a/5b chỉ vẽ nút này ở card Thuế — nhận định đó là thiếu sót lúc dựng mockup hơn là chủ đích (không có lý do nghiệp vụ để 2 card cùng cơ chế "tự điền, sửa tay" lại khác nhau ở đúng điểm này). `design-implementer` thêm nút "Đặt lại" cho cả 2 card khi implement, không chỉ bám đúng pixel mockup.
- **(3) Card "Phí giao dịch" cho màn bán Vàng hiện `0 ₫` + badge, không ẩn.** Nhất quán với tiền lệ `SALE_TAX_GOLD = 0` (quyết định 2026-07-17) vẫn hiện rõ trên UI kèm badge — tránh người dùng không phân biệt được "phí = 0 đã seed tường minh" với "màn này chưa làm phần phí". Mockup 5c hiện không vẽ card phí riêng cho vàng — đây là mở rộng nhỏ so với mockup, cùng tinh thần "seed tường minh, không âm thầm dùng 0" đã áp dụng nhất quán trong Phase 5.
- **(4) 6 key `TRANSACTION_FEE_BUY/SELL_<FUND/BOND/GOLD>` seed = 0%** (chỉ `STOCK` = 0.3%) — xác nhận lại đúng như `phase-5.md`/`docs/domain/07-tax.md` đã ghi "mặc định 0 nếu chưa dùng kênh tính phí %", không có mức thật nào khác cần áp ngay.
- **(Không hỏi, tự quyết kỹ thuật)** Gộp 1 component `AutoFilledAmountCard` dùng chung cho card Thuế/Phí thay vì viết 2 khối JSX riêng — thuần DRY, không ảnh hưởng nghiệp vụ, đúng tiền lệ tái dùng pattern `NavOverrideForm`.
- Docs đã sync: `docs/domain/07-tax.md` (mục "Ca biên" — `SALE_TAX_BOND`, mục "Phí giao dịch" — mức FUND/BOND/GOLD), `process/phase-5.md` (mục "Công việc cần làm"), `process/phase-5-plan-DRAFT.md` (mục "Quyết định còn mở" → đánh dấu đã chốt).

---

## Quyết định liên quan ở file khác

- Thuế lãi trái phiếu (2 key theo `issuerType`), thuế đáo hạn, phí đáo hạn mặc định 0 — [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md).
- `AutoFilledAmountCard` và `submitWhenAuto` ("prefill sửa được" phải `.optional()`, không `.default()`) — [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md), mục 2026-07-29 điểm (3).
- Phí mua gộp vào `avgCost` ảnh hưởng công thức bình quân — [`transactions-and-cost-basis.md`](./transactions-and-cost-basis.md).
