# Roadmap theo phase

Thứ tự ưu tiên dựa trên các quyết định trong [`business-overview.md`](./business-overview.md) và [`domain/`](./domain/README.md): nền tảng + nhập vị thế trước, sau đó lõi XIRR + giá, rồi snapshot, cổ tức/thuế, cuối cùng là biểu đồ.

## Phase 1 — Nền tảng + đăng nhập + nhập vị thế ban đầu
- Scaffold Next.js + TypeScript + Prisma + PostgreSQL
- Đăng nhập Google (Auth.js) và tách dữ liệu theo người dùng (`User`)
- **Chỉ người được mời** (không mở đăng ký công khai): bảng allowlist `AllowedUser` (soft-delete, có audit), chặn tại `signIn` callback (kiểm `email_verified`); dùng **database sessions** để thu hồi quyền tức thời. Một admin seed để bootstrap. Mời có phân quyền (`canInvite`) + giới hạn `MAX_MEMBERS`.
- **Bảng `Setting`** (hạ tầng cấu hình, effective dating) + `resolveSetting` + seed — **chuyển sớm từ Phase 5** vì `MAX_MEMBERS` (access) và `DIVIDEND_TAX_RATE` (cổ tức) đều cần. Phase 5 chỉ còn áp dụng thuế bán.
- Schema: `User`, `AllowedUser`, `Setting`, `Holding`, `Cashflow` + enum (`AssetType`, `CashflowType`, `SettingValueType`). Chưa cần `Dividend`/`Snapshot`/`PriceQuote` ở phase này.
- **Nhập vị thế hiện tại làm mốc:** mỗi mã đang giữ → tạo `Holding` + một `Cashflow` kiểu BUY tại ngày mốc (số lượng × giá vốn bình quân). XIRR tính từ mốc này trở đi.
  - **Không phải tính năng/màn riêng** — chính là thao tác "thêm một Holding mới", dùng mãi về sau mỗi khi mua mã mới.
  - **Luồng lần đầu:** vào thẳng màn chính; khi trống hiện empty state ("Chưa có gì — thêm vị thế đầu tiên") + nút Thêm mã. Form có nút **"Lưu & thêm mã khác"** để nhập liên tiếp nhiều mã. Không có wizard onboarding riêng.
- **Mã cổ phiếu gõ tự do** ở Phase 1 (chưa fetch giá nên mã chỉ là nhãn; autocomplete từ vnstock để sau).
- CRUD cơ bản cho giao dịch mua/bán
- **PWA — cài lên màn hình chính:** manifest (`app/manifest.ts`) + icon (sinh từ `LogoMark`) + service worker viết tay cache tài nguyên tĩnh + trang offline tĩnh. **Không** cache số liệu tài chính (luôn lấy mới từ mạng) — xem chi tiết [`04-tech-stack.md`](./04-tech-stack.md#pwa-cài-lên-màn-hình-chính). Push notification (cảnh báo giá) vẫn ở Backlog.
- Lưu ý: cuối Phase 1 **chưa có định giá thị trường / XIRR / biểu đồ** (cần vnstock ở Phase 2). Phase 1 chỉ nhập–lưu–xem số lượng + tổng vốn.

> **Đã hoãn:** import CSV/Excel từ Google Sheets — dữ liệu cũ không tách chi tiết từng mã nên không dựng lại lịch sử được, tạm thời nhập tay. Xem Backlog.

## Phase 2 — Lõi XIRR + giá tự động
- Ghép dòng tiền giả định (NAV hiện tại) vào cuối chuỗi khi tính, không lưu DB
- Hỗ trợ chọn mốc chốt: hôm nay / cuối tháng / cuối năm / tùy chỉnh
- Hiển thị song song: XIRR (theo năm) + lãi/lỗ tuyệt đối trong kỳ
- Thêm model `PriceQuote` (giá tự động EOD) + job Python ghi qua vnstock; app đọc để định giá
- Tích hợp `vnstock` cho giá tự động (cổ phiếu, quỹ mở); `NavOverride` cho vàng/trái phiếu nhập tay
- Áp **cache có chọn lọc** cho `PriceQuote` (dùng chung theo `symbol`, `revalidate` khớp cadence job) — bắt đầu áp dụng chiến lược cache tầng server đã chốt ([`rules/performance.md`](./rules/performance.md)); Phase 1 cố ý chưa cache

## Phase 3 — Snapshot tự động
- Thêm model `Snapshot` (hoãn từ Phase 1) + migration
- Cron **GitHub Actions workflow** (không chạy hằng ngày): đóng băng snapshot định kỳ (`PERIODIC`) theo lịch cron (tháng → fire ngày 01 ghi cho cuối tháng trước; tuần → theo day-of-week) và cuối năm (`YEAR_END`), `frozen = true`
- Snapshot thủ công khi có giao dịch hoặc bấm "chốt số liệu hôm nay"
- Snapshot tổng danh mục (`holdingId = null`) để phục vụ biểu đồ NAV

## Phase 4 — Cổ tức
- Model `Dividend` (tiền mặt ảnh hưởng XIRR, cổ phiếu tăng số lượng nắm giữ)
- **Cổ tức tiền mặt tự khấu trừ thuế TNCN (~5%):** lưu gộp/thuế/thực nhận, dòng tiền dương cho XIRR = số thực nhận sau thuế
- UI ghi nhận cổ tức gắn với từng `Holding`

## Phase 5 — Thuế bán (áp dụng)
- Bảng `Setting` + `resolveSetting` **đã tạo ở Phase 1** — phase này chỉ dùng.
- Tự động trừ thuế khi ghi giao dịch bán theo `SALE_TAX_<LOẠI>` (tra tại ngày giao dịch), hiển thị lãi/lỗ sau thuế
- Thuế suất chỉnh **trực tiếp trên DB** (không có UI admin)
- Xác nhận mức thuế suất cụ thể trước khi seed; `SALE_TAX_GOLD = 0` **đã chốt** (2026-07-17, cá nhân bán vàng tại VN không chịu thuế TNCN)
- **Chi phí ăn mòn (mới):** dòng phụ dưới lãi/lỗ trên dashboard — tổng thuế + phí luỹ kế (thuế bán + thuế cổ tức + phí giao dịch) và % trên vốn gộp đã triển khai (`Σ|BUY.amount|`, không phải vốn ròng), xem `docs/domain/07-tax.md`

## Phase 6 — Biểu đồ + hoàn thiện dashboard
- Biểu đồ NAV theo thời gian (dựa trên snapshot đã lưu)
- Biểu đồ phân bổ tài sản (% theo `AssetType` tại thời điểm hiện tại)
- **Chế độ ẩn số tiền:** nút mắt bật/tắt nhanh trên dashboard + mặc định trong Settings (`User.hideAmountsByDefault`, lưu theo user). Chỉ che giá trị tiền tuyệt đối, giữ nguyên XIRR và các phần trăm.
- **Cảnh báo tập trung (mới, 2026-07-17):** badge cảnh báo khi một `Holding` vượt `Setting{CONCENTRATION_WARNING_THRESHOLD}` (seed mặc định 30%) — xem `docs/domain/04-pricing-and-valuation.md` mục "Cảnh báo tập trung".

## Phase 7 — Trái tức (lãi trái phiếu)
- Ghi nhận lãi định kỳ (trái tức) cho `Holding{type: BOND}` — khác công thức % cổ tức cổ phiếu hiện có (Phase 4 chỉ scope cho cổ tức cổ phiếu/tiền mặt).
- Mở rộng `DividendType`/`Dividend` (hoặc model tương đương) cho loại lãi trái phiếu; **mệnh giá/coupon rate lưu cố định trên `Holding`** (đã chốt 2026-07-17, đảo hướng đề xuất ban đầu "nhập tay mỗi lần" — cần cho Phase 8 dự đoán kỳ tới), thêm 5 field mới trên `Holding` (xem `docs/domain/10-cashflow-calendar.md`).
- Thuế lãi trái phiếu: xác nhận dùng chung `DIVIDEND_TAX_RATE` hay cần `Setting` key riêng — điểm còn mở, xem `docs/domain/07-tax.md`.
- UI ghi nhận trái tức: mở rộng `DividendForm` hiện có (Phase 4), không dựng màn mới.

## Phase 8 — Lịch dòng tiền sắp tới (mới, 2026-07-17)
- Danh sách trái phiếu sắp **đáo hạn** + **coupon kỳ tới** trong 90 ngày, ước tính từ `parValue`/`couponRatePercent`/`couponFrequencyMonths`/`maturityDate`/`nextCouponDate` (5 field Phase 7 thêm trên `Holding`).
- Chỉ áp dụng `BOND` — không dự đoán cổ tức STOCK/FUND (ngày/mức không cố định theo hợp đồng, không đủ tin cậy).
- Phụ thuộc chặt Phase 7 (đọc field đã thêm, không tự thêm schema). Xem `docs/domain/10-cashflow-calendar.md`, `process/phase-8.md`.

## Backlog (chưa ưu tiên, cân nhắc sau khi dùng thử ổn định)
- Import CSV/Excel từ Google Sheets (hoãn từ Phase 1) — làm khi có nhu cầu nạp dữ liệu chi tiết từng mã
- So sánh benchmark (VN-Index, lãi suất tiết kiệm)
- Nhật ký giao dịch có ghi chú lý do mua/bán
- Cảnh báo giá khi chạm ngưỡng
- Export báo cáo PDF/Excel theo tháng/năm
- Tính năng "what-if": thử XIRR nếu bán ở thời điểm khác
- Nguồn giá vàng dự phòng nếu API chính của `vnstock` lỗi
