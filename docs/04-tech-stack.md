# Tech stack

Các quyết định kỹ thuật được chốt qua trao đổi. Mỗi lựa chọn kèm lý do để sau này nhìn lại còn hiểu vì sao.

## Tổng quan kiến trúc

Ba mảnh tách biệt, nối với nhau qua PostgreSQL:

```
┌─────────────────────┐        ┌──────────────────────┐
│  App Next.js         │  đọc   │                      │
│  (Vercel)            │──────▶ │   PostgreSQL (Neon)  │
│  - Giao diện         │        │                      │
│  - Đăng nhập Google  │        │   Schema = "hợp đồng"│
│  - Tính XIRR         │        │   chung giữa 2 thế   │
│  - Biểu đồ           │        │   giới               │
└─────────────────────┘        └──────────▲───────────┘
                                          │ ghi
                               ┌──────────┴───────────┐
                               │  Job Python + vnstock │
                               │  (GitHub Actions,     │
                               │   chạy theo lịch)     │
                               │  - Lấy giá hằng ngày  │
                               │  - Chốt snapshot      │
                               └──────────────────────┘
```

**Nguyên tắc cốt lõi:** app TypeScript **chỉ đọc** giá từ DB, không bao giờ gọi vnstock trực tiếp. Job Python **chỉ ghi** vào DB, không đi qua app. Vì hai thế giới không gọi nhau, **schema database trở thành hợp đồng chung** — thay đổi schema phải đồng bộ cả hai phía.

## Các quyết định

| Mảng | Lựa chọn | Lý do |
|---|---|---|
| Framework | **Next.js + TypeScript** | Đã quen, hợp cho cả frontend lẫn API |
| ORM + DB | **Prisma + PostgreSQL** | Type-safe, khớp dự án hiện có |
| Database hosting | **Neon** (free tier) | $0 thật cho dữ liệu nhỏ; tự ngủ/tự thức, không phải bấm tay bật lại (khác Supabase) |
| App hosting | **Vercel** (free tier) | Chuẩn cho Next.js, $0 |
| Nguồn giá | **Python + vnstock**, chạy trên **GitHub Actions** theo lịch | vnstock là thư viện Python; job chỉ chạy theo lịch nên không cần server thường trú → GitHub Actions free |
| Đăng nhập | **Auth.js + Google OAuth** | Không mật khẩu, không cần dịch vụ email, ai cũng có Google |
| Giao diện | **Tailwind CSS + shadcn/ui** | Tự sở hữu component, hiện đại, khớp Next App Router và Recharts |
| Biểu đồ | **Recharts** | Khớp liền shadcn/ui (component chart dựng trên Recharts), đủ cho NAV + phân bổ |
| Tính XIRR | **Lai: thư viện npm + lớp bọc kiểm tra** | Thư viện làm lõi tính; tự bọc validate dấu dòng tiền, bắt ca không hội tụ, gắn nhãn "theo năm" |
| Import dữ liệu cũ | **CSV + PapaParse** | Sheet gom về một bảng, xuất CSV; import là di trú một lần nên giữ đơn giản |

## Ghi chú triển khai

### Job Python (GitHub Actions)
- Kết nối Neon qua connection string, lưu trong **GitHub Secrets** (không hardcode).
- Chạy theo lịch (cron của GitHub Actions) — lưu ý lịch này lệch vài phút, không chính xác từng phút, nhưng không sao với snapshot ngày/tháng/năm.
- Nhiệm vụ: lấy giá hằng ngày cho cổ phiếu/quỹ; chốt snapshot cuối tháng/năm. Vàng/trái phiếu chủ yếu nhập tay (xem `02-data-model.md`).

### XIRR (lớp bọc kiểm tra)
- Trước khi tính: kiểm tra chuỗi dòng tiền có ít nhất một giá trị âm và một dương — nếu không, trả về trạng thái "không tính được" rõ ràng, **không** trả -100% hay NaN âm thầm.
- Sau khi tính: nếu thuật toán không hội tụ, báo lỗi tường minh thay vì trả số bậy.
- Luôn gắn nhãn kết quả là **tỷ suất theo năm (annualized)**.
- **Bắt buộc có test** đối chiếu với kết quả XIRR của Excel/Google Sheets trên dữ liệu thật.

### Đăng nhập
- Google OAuth qua Auth.js. Tài khoản do quản trị tạo/mời — **không mở đăng ký công khai** (phù hợp tính chất phi thương mại). Có thể giới hạn bằng danh sách email được phép.

## Chi phí

Tổng: **~$0/tháng** — Vercel, Neon, GitHub Actions đều dùng free tier, dữ liệu nhỏ nên không chạm giới hạn. Job Python chạy mỗi ngày cũng giữ cho DB không bị coi là "không hoạt động".
