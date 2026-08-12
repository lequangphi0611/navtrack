# Quyết định — Roadmap & phạm vi phase

Phạm vi: thêm/đổi phase, đưa ý tưởng vào roadmap, phân loại vấn đề "sửa docs ngay" vs "log issue sửa sau".
Tài liệu liên quan: [`docs/03-roadmap.md`](../../docs/03-roadmap.md), [`process/PROCESS.md`](../PROCESS.md), `process/phase-*.md`.

---

## 2026-07-16 (3) — Thêm Phase 7 (trái tức) vào roadmap

**Status:** Accepted — điểm mở (1) đã đảo ở [2026-07-17 (5)](#2026-07-17-5--thêm-cảnh-báo-tập-trung-phase-6--lịch-dòng-tiền-phase-8), điểm mở (2) đã đóng ở [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md) mục 2026-07-25 (2) điểm (4)

**Thêm Phase 7 — Trái tức (lãi trái phiếu) vào roadmap, ngoài trình tự ưu tiên gốc.**
- Bối cảnh: `docs/domain/03-dividends.md` mục "Ca biên" từ đầu đã cố tình để ngỏ "cổ tức của trái phiếu... xử lý cụ thể khi làm Phase liên quan" — Phase 4 (đã ✅ xong) chỉ scope cổ tức tiền mặt/cổ phiếu cho STOCK/FUND, không bao gồm lãi trái phiếu (công thức khác: coupon rate × mệnh giá theo kỳ, không phải `% × parValue` cố định).
- Quyết định: tạo **Phase 7** mới (`process/phase-7.md`, thêm dòng roadmap `docs/03-roadmap.md`) thay vì gộp vào Phase 4 đã đóng hoặc để mãi trong Backlog không phase — vì đây là việc đủ lớn (mở rộng schema + Server Action + UI) để cần theo dõi như một phase riêng, nhưng không thuộc trình tự ưu tiên gốc (chỉ làm khi có nhu cầu, không chặn Phase 5/6).
- Chia 3 issue qua `issue-breakdown`, thứ tự: **Schema & Setting** (không phụ thuộc) → **Design & UI** (mở rộng `DividendForm` có sẵn, dùng mock cho field mệnh giá/coupon rate mới, chạy song song Schema) → **Server Action + tính toán** (phụ thuộc cả 2, cần Props contract thật từ UI + bảng đã migrate từ Schema).
- **Điểm cố ý chưa chốt, để ngỏ cho issue lúc implement quyết định** (không tự chọn thay): (1) mệnh giá/coupon rate nhập tay mỗi lần ghi (nhất quán cách cổ tức tiền mặt `percent` hiện đã hoạt động) hay lưu cố định trên `Holding` — đề xuất mặc định "nhập tay mỗi lần" vì mỗi trái phiếu mệnh giá khác nhau, không có Setting mặc định dùng chung hợp lý như `DIVIDEND_PAR_VALUE` của cổ phiếu; (2) thuế lãi trái phiếu dùng chung `DIVIDEND_TAX_RATE` hay cần `Setting` key riêng (`docs/domain/07-tax.md` mục "Ca biên" đã ghi mức thuế là "điểm còn mở" từ Phase 1, chưa nói riêng về trái phiếu).
- Docs đã sync: `docs/03-roadmap.md` (mục Phase 7), `process/PROCESS.md` (bảng trạng thái + nhật ký), `process/phase-7.md` (mới).

---

## 2026-07-17 (5) — Thêm "Cảnh báo tập trung" (Phase 6) + "Lịch dòng tiền" (Phase 8)

**Status:** Accepted — phần `BondTerms`/`nextCouponDate` đã đảo ở [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md) mục 2026-07-25 (2) điểm (1)(2)

**Thêm 2 ý tưởng còn lại vào roadmap: "Cảnh báo tập trung" (Phase 6) và "Lịch dòng tiền sắp tới" (Phase 8 mới) — cùng đảo quyết định treo Phase 7 (1).**
- Bối cảnh: tiếp tục danh sách 3 ý tưởng gợi ý ngoài roadmap ban đầu (idea 1 — chi phí ăn mòn — đã vào Phase 5 ở quyết định 2026-07-17 (4), xem [`tax-and-fees.md`](./tax-and-fees.md)). User xác nhận đưa nốt idea 2 (cảnh báo tập trung) và idea 3 (lịch dòng tiền) vào domain docs + roadmap + phase-x.
- **Cảnh báo tập trung (Phase 6):**
  - **Phạm vi (đã hỏi user, chọn theo Holding):** cảnh báo theo từng `Holding` riêng lẻ, KHÔNG theo `AssetType` nhóm — sát rủi ro thực tế hơn dù `AllocationBar` theo nhóm đã có sẵn dễ tái dùng hơn.
  - **Ngưỡng (đã hỏi user):** 30%, cấu hình qua `Setting{CONCENTRATION_WARNING_THRESHOLD}` (group mới `RISK`) — user chủ động chọn "cấu hình trên Settings" thay vì hard-code, nhất quán nguyên tắc "cấu hình được, không hard-code" của `07-tax.md`.
  - Resolve `atDate = hôm nay` (không effective-dated theo giao dịch) — cùng pattern với `MAX_MEMBERS`.
  - Vị thế `MISSING_PRICE` loại khỏi tính cảnh báo (không mặc định 0%) — nhất quán nguyên tắc "thiếu giá không mặc định 0".
  - Docs: `docs/domain/04-pricing-and-valuation.md` (mục "Cảnh báo tập trung" mới), `docs/domain/09-settings.md`, `process/phase-6.md`, `docs/03-roadmap.md`.
- **Lịch dòng tiền sắp tới (Phase 8 mới):**
  - **Phạm vi (đã hỏi user, chọn chỉ trái phiếu):** chỉ đáo hạn + coupon trái phiếu — cố tình KHÔNG dự đoán cổ tức STOCK/FUND vì không có ngày/mức cố định theo hợp đồng, dự đoán sẽ không đáng tin.
  - **Đảo quyết định treo Phase 7 điểm mở (1)** (đã hỏi user, chọn lưu cố định trên Holding) — **→ ĐÃ SỬA MỘT PHẦN ở 2026-07-25 (2): vẫn "lưu cố định" nhưng chuyển sang bảng riêng `BondTerms`, và BỎ `nextCouponDate` cộng tay (thay bằng `firstCouponDate` + suy runtime).** Nội dung gốc: mệnh giá/coupon rate **lưu cố định trên `Holding`** (5 field mới: `parValue`/`couponRatePercent`/`couponFrequencyMonths`/`maturityDate`/`nextCouponDate`, chỉ có ý nghĩa khi `type = BOND`) thay vì "nhập tay mỗi lần ghi" như đề xuất mặc định ban đầu của Phase 7 — cần thiết để suy ra "kỳ tới" cho Phase 8. `recordDividend` (Phase 7) đọc từ `Holding`, không hỏi lại; tự cộng `couponFrequencyMonths` vào `nextCouponDate` sau mỗi lần ghi thành công, vẫn cho user sửa tay.
  - **Phase 8 phụ thuộc chặt Phase 7** (đọc field Phase 7 thêm, không tự thêm schema) — không phải trình tự ưu tiên gốc, giống Phase 7.
  - Ước tính đáo hạn KHÔNG trừ thuế (nhất quán quyết định "đáo hạn không chịu SALE_TAX_BOND" ở `07-tax.md`); ước tính coupon hiển thị số gộp trước thuế (công thức thuế lãi trái phiếu chính xác vẫn là điểm mở của Phase 7, không tự chọn thay ở đây).
  - Docs: `docs/domain/10-cashflow-calendar.md` (file mới), `docs/domain/README.md` (index #10), `docs/domain/01-assets-and-holdings.md`, `docs/02-data-model.md` (5 field mới trên `Holding`), `process/phase-7.md` (đảo điểm mở (1)), `process/phase-8.md` (file mới), `docs/03-roadmap.md` (Phase 7 cập nhật + Phase 8 mới), `process/PROCESS.md` (bảng trạng thái + nhật ký).

---

## 2026-07-17 (7) — Rà nghiệp vụ tài chính: chốt A2, log C1/C2/B1 thành issue, B2 giữ Backlog

**Status:** Accepted — A2 đã thu hẹp ở [`pricing-and-valuation.md`](./pricing-and-valuation.md) mục 2026-07-21 điểm (1); C1/C2/B1 đều đã đóng (xem bên dưới)

**Rà soát nghiệp vụ dưới góc nhìn tài chính — chốt A2 (sửa docs), log C1/C2/B1 thành issue để sửa sau; B2 giữ ở Backlog.**
- Bối cảnh: tiếp tục rà bất cập nghiệp vụ với user. Phân loại theo "đã phản ánh vào code hay chưa": vấn đề nằm trong code đã ship → tạo issue sửa sau; vấn đề chỉ ở spec Phase 5+ chưa code → sửa docs ngay.
- **A2 (sửa docs — spec Phase 6 chưa code):** cảnh báo tập trung dùng `NAV(danh mục)` làm mẫu số; khi danh mục còn mã `MISSING_PRICE` thì mẫu số là **NAV một phần** (`navValueIsPartial`), làm `concentrationPercent` của các mã *có giá* bị thổi phồng → báo động giả (vd FPT 180tr + trái phiếu 300tr chưa nhập giá → FPT "100%"). **Quyết định: khi `navValueIsPartial` thì TREO cảnh báo tập trung** (không kết luận trên mẫu số khuyết), kèm ghi chú cần cập nhật giá — giống cách NAV gắn dấu `*`. Chỉ tính khi NAV danh mục đầy đủ. Docs: `docs/domain/04-pricing-and-valuation.md` (mục "Cảnh báo tập trung"), `process/phase-6.md` (tiêu chí). **→ Thu hẹp ở 2026-07-21: chỉ treo khi `missingPriceShare > 5%`.**
- **C1/C2/B1 (đã phản ánh trong code Phase 1/2/4 → log issue, sửa sau):**
  - **#65 (C1):** dòng tiền cổ tức/coupon vào XIRR đặt tại `date` (ngày chia) thay vì `paymentDate` (ngày tiền thực về) — `xirr-cashflow.ts:21`; lợi suất bị thổi nhẹ, rõ hơn với coupon trái phiếu kỳ dài. Sẽ đảo một phần quyết định #61 ("paymentDate thuần thông tin") khi làm. **→ Đã đóng 2026-07-19, xem [`returns-xirr-and-pnl.md`](./returns-xirr-and-pnl.md).**
  - **#66 (C2):** phí mua không gộp vào `avgCost` (`cost-basis.ts:54`) → "lãi đã thực hiện" per-lot hơi cao hơn thực. Hai hướng (A gộp phí vào cost basis / B giữ + sửa nhãn), chốt lúc implement. **→ Đã đóng 2026-07-18 (4) theo hướng A, xem [`tax-and-fees.md`](./tax-and-fees.md).**
  - **#67 (B1):** lãi/lỗ tuyệt đối gộp chung đã-thực-hiện vs chưa-thực-hiện (`portfolio-valuation.ts`) — đề xuất tách, gộp làm ở Phase 6, phụ thuộc C2. **→ Đã đóng 2026-07-24, xem [`returns-xirr-and-pnl.md`](./returns-xirr-and-pnl.md).**
- **B2 (benchmark lãi suất tiết kiệm):** đã nằm ở Backlog (`docs/03-roadmap.md`) — đây là câu hỏi gốc của `business-overview.md` ("có hơn gửi tiết kiệm không?"). Không tạo issue trùng; nếu muốn kéo lên phase gần thì sửa roadmap (chưa làm, chờ user quyết). **Còn treo.**

---

## Quyết định liên quan ở file khác

- Chi phí ăn mòn (idea 1, vào Phase 5) — [`tax-and-fees.md`](./tax-and-fees.md), mục 2026-07-17 (4).
- Spec chi tiết cảnh báo tập trung sau khi rà lại — [`pricing-and-valuation.md`](./pricing-and-valuation.md), mục 2026-07-21.
- Spec chi tiết Phase 7/8 (BondTerms, `firstCouponDate`, `MATURITY`) — [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md).
