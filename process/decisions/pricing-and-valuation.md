# Quyết định — Định giá & cảnh báo tập trung

Phạm vi: `NavOverride`, `PriceQuote`, `resolvePrice()`, NAV, `MISSING_PRICE`, cảnh báo tập trung.
Spec tương ứng: [`docs/domain/04-pricing-and-valuation.md`](../../docs/domain/04-pricing-and-valuation.md).

---

## 2026-07-12 — `NavOverride`: `@@unique([holdingId, date])` + `@db.Date`

**Status:** Accepted

**`NavOverride`: `@@unique([holdingId, date])` + `@db.Date` — upsert tự động, sửa giá cùng ngày phải ghi đè.**

---

## 2026-07-14 — Đổi rule ưu tiên giá: so ngày `NavOverride` vs `PriceQuote` (issue #40)

**Status:** Accepted

**Đổi rule ưu tiên giá: so ngày `NavOverride` vs `PriceQuote`, không còn "nhập tay luôn thắng" (issue #40).**
- Bối cảnh: STOCK/FUND định giá tự động nhưng vẫn cho sửa tay. Rule cũ (`resolvePrice()`, `src/lib/valuation.ts`) luôn ưu tiên `NavOverride` nếu tồn tại, bất kể ngày — một lần nhập tay giá sẽ shadow vĩnh viễn mọi `PriceQuote` mới hơn về sau, giá nhập tay cũ không tự nhường lại cho giá tự động mới.
- Quyết định: `resolvePrice()` so `date` giữa 2 nguồn (đã lọc "gần nhất ≤ D" ở tầng query, không đổi), dùng nguồn có `date` mới hơn; cùng ngày → vẫn ưu tiên NavOverride. Chỉ có 1 nguồn (GOLD/BOND không có PriceQuote) → hành vi không đổi.
- Docs đã sync: `docs/domain/04-pricing-and-valuation.md` (mục "Ưu tiên giá tại ngày D" + thêm ví dụ staleness).

---

## 2026-07-21 — Rà spec Phase 6 (cảnh báo tập trung + XIRR toàn danh mục): 4 tinh chỉnh

**Status:** Accepted — thu hẹp rule A2 chốt ở [`roadmap-and-scope.md`](./roadmap-and-scope.md) mục 2026-07-17 (7)

**Rà soát spec Phase 6 (cảnh báo tập trung + XIRR toàn danh mục) dưới góc nhìn chuyên gia tài chính — 4 tinh chỉnh, chưa code nên sửa spec trực tiếp.**
- Bối cảnh: dùng subagent đóng vai chuyên gia tài chính đọc `process/phase-6.md` + `docs/domain/04-pricing-and-valuation.md` mục "Cảnh báo tập trung" để đánh giá độc lập trước khi implement. Phát hiện 4 điểm: rule A2 (treo cảnh báo toàn danh mục khi có `MISSING_PRICE`, chốt ở entry 2026-07-17 (7)) quá bảo thủ; ngưỡng 30% cố định gây báo động giả với danh mục ít mã; không có cơ chế chống nhấp nháy quanh ngưỡng; biểu đồ phân bổ theo nhóm và badge cảnh báo theo mã là hai lát cắt không liên kết, dễ gây hiểu lầm "đã đa dạng" trong khi có mã lệch. Đã hỏi lại user từng điểm (không tự chọn thay).
- **(1) Materiality cho `MISSING_PRICE` — thu hẹp rule A2 (đã hỏi user, chọn 5%):** thay vì treo cảnh báo *toàn danh mục* bất kể mã thiếu giá chiếm bao nhiêu, chỉ treo khi `missingPriceShare > 5%` — `missingPriceShare` ước lượng bằng `totalCostBasis` (không phải NAV, vì mã thiếu giá không có giá thị trường để tính NAV) của các `Holding MISSING_PRICE` trên tổng NAV(có giá)+costBasis(thiếu giá). Dưới 5%, vẫn cảnh báo bình thường trên các mã có giá (mẫu số loại phần thiếu giá) kèm ghi chú NAV thiếu một phần. `5%` là hằng số code, không phải `Setting` (tham số chống nhiễu hiển thị, khác khẩu vị rủi ro).
- **(2) Ghi chú "tập trung tự nhiên do ít mã" (đã hỏi user, chọn để app tự tính thay vì hard-code số mã cố định):** thay vì chọn một ngưỡng N Holding tuỳ ý, dùng chính công thức toán học: nếu `100 / n > threshold` (n = số Holding mở có giá) thì ngay cả chia đều tuyệt đối cũng đã vượt ngưỡng — mọi badge trong ca này kèm ghi chú ngữ cảnh giải thích, tránh hiểu nhầm "chọn lệch" khi thực chất là hệ quả của có ít mã.
- **(3) Hysteresis (đã hỏi user, chọn buffer 3 điểm %, áp dụng luôn trong Phase 6 thay vì để Backlog):** badge bật ở `threshold`, chỉ tắt khi xuống dưới `threshold − 3`, chống nhấp nháy khi giá dao động sát ngưỡng. Cần lưu trạng thái cảnh báo trước đó per-`Holding` giữa các lần tính — cách lưu cụ thể (field DB...) để ngỏ cho `business-implementer` quyết định lúc code.
- **(4) Chú thích liên kết giữa biểu đồ phân bổ (theo nhóm) và cảnh báo tập trung (theo mã) (đã hỏi user, chọn thêm chú thích nhỏ, không làm drill-down):** khi có ≥1 Holding đang cảnh báo, hiện dòng chú thích nhỏ dưới biểu đồ phân bổ tài sản trỏ xuống bảng vị thế.
- **Không đổi:** cách tính XIRR toàn danh mục (đã đúng trong code — gộp cashflow mọi Holding thành một chuỗi, giải một lần, không cộng dồn XIRR riêng lẻ) — chỉ làm rõ tường minh nguyên tắc này vào domain doc để tránh implementer hiểu nhầm khi động tới Tab "Đã đóng" của Phase 6.
- Docs đã sync: `docs/domain/04-pricing-and-valuation.md` (mục "Cảnh báo tập trung" — thu hẹp A2 + 3 mục mới), `docs/domain/05-returns-xirr-and-pnl.md` (mục "Quy tắc & bất biến", câu làm rõ XIRR toàn danh mục), `docs/domain/09-settings.md` (ghi chú 5%/3 điểm % không phải `Setting`), `process/phase-6.md` (Công việc cần làm + Tiêu chí hoàn thành), `docs/03-roadmap.md` (Phase 6).

---

## 2026-07-21 (2) — Mockup Phase 6 thật: 4 điểm đã xác nhận với user

**Status:** Accepted

> Entry này trong file gốc là sub-entry không đánh số nằm dưới cùng heading `2026-07-21`. Nhãn `(2)` thêm ở đây để phân biệt; citation cũ dạng `DECISION.md 2026-07-21` vẫn đúng cho cả hai.

**`design-fetcher` kéo mockup Phase 6 thật (`Phase 6 Screens.dc.html`, 10 màn 6a-6j), sinh digest `process/UI_phase_6.md`; 4 điểm cần xác nhận đã hỏi user, chọn theo đề xuất cả 4.**
- Bối cảnh: digest liệt kê 9 điểm lệch/cần xác nhận giữa mockup và `phase-6.md`; 4 điểm ảnh hưởng kiến trúc/nghiệp vụ được hỏi user trước khi giao `planner`, 5 điểm còn lại (bố cục 6b/6c đơn giản hơn 6a/6e, giữ pattern `formatMoney` bullet thay vì CSS blur mockup vẽ, bỏ mục "Biểu thuế & phí" ngoài scope ở 6f, route riêng cho màn Phân bổ 6d thay vì Sheet, tab mặc định "Mua" khi bấm "Mở lại vị thế" ở 6i) là quyết định kỹ thuật thuần theo khuyến nghị digest, không cần hỏi.
- **(1) Nút mắt header (6e) và toggle "Chế độ ẩn số tiền" (6f) — cùng một trạng thái, cả hai ghi `User.hideAmountsByDefault` ngay lập tức** khi bấm/gạt — không có tầng "override phiên tạm thời" riêng, tránh 2 tầng state không cần thiết.
- **(2) "XIRR bình quân" của vị thế đã đóng (tab 6g) — weighted average theo vốn mua vào từng vị thế đã đóng**, không phải trung bình cộng đơn giản — nhất quán cách XIRR toàn danh mục gộp cashflow theo tỷ trọng thay vì cộng dồn XIRR riêng lẻ (đã chốt entry trên).
- **(3) Ghi chú "tập trung tự nhiên do ít mã" (biến thể 2, badge 6j) — chỉ thêm dòng giải thích cho Holding ĐÃ có badge (đã vượt threshold)**, không tự tạo badge mới cho Holding đang dưới ngưỡng riêng lẻ dù `100/n > threshold` đúng toàn danh mục.
- **(4) Chú thích liên kết cảnh báo tập trung trên biểu đồ phân bổ (6d) — luôn dùng câu chung "N mã đang vượt ngưỡng tập trung..."**, kể cả khi N=1; không nêu đích danh tên mã/% dù mockup vẽ ví dụ cụ thể — khớp đúng câu chữ `phase-6.md` đã định nghĩa, tránh thêm nhánh logic riêng cho N=1.
- Docs đã sync: không đổi domain docs (đây là quyết định UI/kiến trúc state, không phải công thức nghiệp vụ mới) — chỉ ghi nhận ở đây để `planner`/implementer bám đúng, tham chiếu `process/UI_phase_6.md` mục "Điểm lệch/cần xác nhận".

---

## 2026-08-16 — Stock allocation drill-down (#131): route riêng, không accordion

**Status:** Accepted

**Drill-down "% theo mã trong nhóm cổ phiếu" từ `/allocation` dùng route riêng full-screen, không phải accordion mở tại chỗ trong `AllocationScreen`.**
- Bối cảnh: digest `process/UI_stock-allocation-detail.md` (mockup 131a-d) để ngỏ 2 hướng — Props phác thảo (`backHref: string`) đã theo hình dạng route.
- Quyết định: chọn route riêng, nối tiếp tiền lệ chính `/allocation` (2026-07-21: mockup vẽ full-screen với back button, không phải Sheet) — mockup 131a-d cũng vẽ `PageHeader variant="back"` full-screen, không phải khối mở rộng trong card.
- **Đã đóng 2026-08-16 (#132):** `ROUTES.allocationStock` (`/allocation/stock`), `getStockAllocationDetail()` (`lib/portfolio-valuation.ts`, tái dùng `computeStockGroupAllocation()` thuần ở `lib/stock-group-allocation.ts` + `getConcentrationBadges()` có sẵn), `page.tsx`/`loading.tsx` thật, `StockAllocationDetailClient` (client wrapper giữ state `hidden`/sort cục bộ, mirror `DashboardScreenClient`), và đổi dòng legend "Cổ phiếu" trong `AllocationScreen.tsx` thành `<Link>` (các nhóm tài sản khác vẫn `<div>` tĩnh, chưa có view chi tiết tương ứng).
- Docs đã sync: không đổi domain docs (quyết định kiến trúc/route, không phải công thức nghiệp vụ mới).

---

## Quyết định liên quan ở file khác

- Đưa "Cảnh báo tập trung" vào Phase 6 + ngưỡng 30% qua `Setting{CONCENTRATION_WARNING_THRESHOLD}` — [`roadmap-and-scope.md`](./roadmap-and-scope.md), mục 2026-07-17 (5).
- Rule A2 gốc (treo cảnh báo khi NAV khuyết giá) — [`roadmap-and-scope.md`](./roadmap-and-scope.md), mục 2026-07-17 (7).
- `NavOverride` bù pha loãng khi ghi cổ tức — [`dividends.md`](./dividends.md), mục 2026-07-17.
- `User.hideAmountsByDefault` (điểm (1) ở entry 2026-07-21 (2)) — cũng liên quan [`users-access-and-privacy.md`](./users-access-and-privacy.md).
