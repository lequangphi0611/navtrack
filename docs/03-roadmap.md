# Roadmap theo phase

Thứ tự ưu tiên dựa trên các quyết định trong `01-business-decisions.md`: import dữ liệu cũ trước (để không phải nhập tay lại), sau đó lõi XIRR, rồi tới cổ tức/thuế, cuối cùng là biểu đồ.

## Phase 1 — Nền tảng + đăng nhập + nhập vị thế ban đầu
- Scaffold Next.js + TypeScript + Prisma + PostgreSQL
- Đăng nhập Google (Auth.js) và tách dữ liệu theo người dùng (`User`)
- **Chỉ người được mời** (không mở đăng ký công khai): bảng allowlist `AllowedUser` (soft-delete, có audit), chặn tại `signIn` callback (kiểm `email_verified`); dùng **database sessions** để thu hồi quyền tức thời. Một admin seed để bootstrap.
- Schema: `User`, `AllowedUser`, `Holding`, `Cashflow` + enum (`AssetType`, `CashflowType`). Chưa cần `Dividend`/`Setting`/`Snapshot` ở phase này.
- **Nhập vị thế hiện tại làm mốc:** mỗi mã đang giữ → tạo `Holding` + một `Cashflow` kiểu BUY tại ngày mốc (số lượng × giá vốn bình quân). XIRR tính từ mốc này trở đi.
  - **Không phải tính năng/màn riêng** — chính là thao tác "thêm một Holding mới", dùng mãi về sau mỗi khi mua mã mới.
  - **Luồng lần đầu:** vào thẳng màn chính; khi trống hiện empty state ("Chưa có gì — thêm vị thế đầu tiên") + nút Thêm mã. Form có nút **"Lưu & thêm mã khác"** để nhập liên tiếp nhiều mã. Không có wizard onboarding riêng.
- **Mã cổ phiếu gõ tự do** ở Phase 1 (chưa fetch giá nên mã chỉ là nhãn; autocomplete từ vnstock để sau).
- CRUD cơ bản cho giao dịch mua/bán
- Lưu ý: cuối Phase 1 **chưa có định giá thị trường / XIRR / biểu đồ** (cần vnstock ở Phase 2). Phase 1 chỉ nhập–lưu–xem số lượng + tổng vốn.

> **Đã hoãn:** import CSV/Excel từ Google Sheets — dữ liệu cũ không tách chi tiết từng mã nên không dựng lại lịch sử được, tạm thời nhập tay. Xem Backlog.

## Phase 2 — Lõi tính XIRR
- Ghép dòng tiền giả định (NAV hiện tại) vào cuối chuỗi khi tính, không lưu DB
- Hỗ trợ chọn mốc chốt: hôm nay / cuối tháng / cuối năm / tùy chỉnh
- Hiển thị song song: XIRR (theo năm) + lãi/lỗ tuyệt đối trong kỳ
- Thêm model `PriceQuote` (giá tự động EOD) + job Python ghi qua vnstock; app đọc để định giá
- Tích hợp `vnstock` cho giá tự động (cổ phiếu, quỹ mở); `NavOverride` cho vàng/trái phiếu nhập tay

## Phase 3 — Snapshot tự động
- Thêm model `Snapshot` (hoãn từ Phase 1) + migration
- Cron: đóng băng snapshot cuối tháng, cuối năm (`frozen = true`)
- Snapshot thủ công khi có giao dịch hoặc bấm "chốt số liệu hôm nay"
- Snapshot tổng danh mục (`holdingId = null`) để phục vụ biểu đồ NAV

## Phase 4 — Cổ tức
- Model `Dividend` (tiền mặt ảnh hưởng XIRR, cổ phiếu tăng số lượng nắm giữ)
- **Cổ tức tiền mặt tự khấu trừ thuế TNCN (~5%):** lưu gộp/thuế/thực nhận, dòng tiền dương cho XIRR = số thực nhận sau thuế
- UI ghi nhận cổ tức gắn với từng `Holding`

## Phase 5 — Thuế
- Bảng master `Setting` (cấu hình được, effective dating) giữ thuế bán `SALE_TAX_<LOẠI>` và thuế cổ tức `DIVIDEND_TAX_RATE`
- Thuế suất chỉnh **trực tiếp trên DB** (không có UI admin); app chỉ resolve, tra thuế theo ngày giao dịch (effective dating)
- Tự động trừ thuế khi ghi giao dịch bán, hiển thị lãi/lỗ sau thuế
- Xác nhận mức thuế suất cụ thể trước khi seed (điểm còn mở)

## Phase 6 — Biểu đồ + hoàn thiện dashboard
- Biểu đồ NAV theo thời gian (dựa trên snapshot đã lưu)
- Biểu đồ phân bổ tài sản (% theo `AssetType` tại thời điểm hiện tại)
- **Chế độ ẩn số tiền:** nút mắt bật/tắt nhanh trên dashboard + mặc định trong Settings (`User.hideAmountsByDefault`, lưu theo user). Chỉ che giá trị tiền tuyệt đối, giữ nguyên XIRR và các phần trăm.

## Backlog (chưa ưu tiên, cân nhắc sau khi dùng thử ổn định)
- Import CSV/Excel từ Google Sheets (hoãn từ Phase 1) — làm khi có nhu cầu nạp dữ liệu chi tiết từng mã
- So sánh benchmark (VN-Index, lãi suất tiết kiệm)
- Nhật ký giao dịch có ghi chú lý do mua/bán
- Cảnh báo giá khi chạm ngưỡng
- Export báo cáo PDF/Excel theo tháng/năm
- Tính năng "what-if": thử XIRR nếu bán ở thời điểm khác
- Nguồn giá vàng dự phòng nếu API chính của `vnstock` lỗi
