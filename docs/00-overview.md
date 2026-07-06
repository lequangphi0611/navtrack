# Tổng quan dự án

## Mục tiêu

Web app quản lý danh mục đầu tư cá nhân (cổ phiếu, quỹ mở, trái phiếu, vàng), thay thế Google Sheets hiện tại. Tính lãi/lỗ theo XIRR, hỗ trợ import lịch sử giao dịch cũ, theo dõi cổ tức và thuế.

## Phạm vi

- **Đối tượng dùng:** cá nhân (không phải sản phẩm thương mại/SaaS). Điều này cho phép dùng bản miễn phí của `vnstock` mà không vướng vấn đề license thương mại.
- **Loại tài sản hỗ trợ từ v1:** cổ phiếu, quỹ mở, trái phiếu, vàng (đủ 4 loại ngay từ đầu, khớp với Sheet hiện tại).

## Stack kỹ thuật

- Next.js + TypeScript + Prisma + PostgreSQL (khớp với các dự án hiện có)
- Nguồn giá tự động: `vnstock` (cổ phiếu, quỹ mở, vàng SJC nếu ổn định)
- Hạ tầng: cloud free/giá rẻ (Vercel/Railway/Supabase free tier, hoặc VPS ~$5–10/tháng) — chưa chốt nhà cung cấp cụ thể, quyết định khi bắt đầu deploy.

## Tài liệu liên quan

- [`01-business-decisions.md`](./01-business-decisions.md) — các quyết định nền tảng đã chốt qua trao đổi
- [`02-data-model.md`](./02-data-model.md) — schema Prisma
- [`03-roadmap.md`](./03-roadmap.md) — roadmap theo phase
