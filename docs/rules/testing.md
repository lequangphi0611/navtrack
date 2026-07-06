# Testing

Chiến lược test cho Navtrack: tập trung vào **logic đúng** (nhất là tính tiền), không test UI.

## Unit test — chỉ test logic

- Dùng **Vitest**.
- Chỉ test **logic thuần**, không test render/UI của component. Ưu tiên:
  - Tính **XIRR** (lớp bọc `lib/xirr.ts`) — bao gồm ca biên: chuỗi dòng tiền không hợp lệ, không hội tụ, kỳ ngắn.
  - Toán tiền/`Decimal` (tổng vốn, lãi/lỗ, thuế).
  - Helper format (`lib/format.ts`), gồm chế độ ẩn số tiền.
  - Zod schema (`schemas.ts`).
- **Bắt buộc test XIRR đối chiếu** với kết quả XIRR của Excel/Google Sheets trên bộ dữ liệu mẫu.
- Đặt file test colocate cạnh file logic: `xirr.ts` → `xirr.test.ts`.

## Không test UI

- Không viết test render/snapshot cho component. UI được phủ gián tiếp qua end-to-end.

## End-to-end — Playwright

- Dùng **Playwright** cho các luồng chính: đăng nhập Google, nhập vị thế ban đầu, ghi giao dịch, xem dashboard, bật/tắt ẩn số tiền.
- Đặt trong thư mục `e2e/` riêng.
