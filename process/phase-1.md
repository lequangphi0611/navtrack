# Phase 1 — Nền tảng + đăng nhập + nhập vị thế ban đầu

## Mục tiêu
Dựng nền tảng chạy được: đăng nhập Google (chỉ người được mời), tách dữ liệu theo user, nhập vị thế đang giữ và CRUD giao dịch mua/bán cho cả 4 loại tài sản. **Chưa có định giá thị trường / XIRR / biểu đồ** (thuộc Phase 2+).

## Công việc cần làm
- [ ] Scaffold Next.js + TypeScript (App Router), **pnpm**, cấu trúc `src/`
- [ ] Tailwind + shadcn/ui; ESLint + Prettier; husky + lint-staged; `tsconfig` strict + `noUncheckedIndexedAccess`
- [ ] Prisma + kết nối **Neon**; `lib/db.ts` (singleton); `lib/logger.ts` (pino); `.env.example`
- [ ] Auth.js + Google OAuth; **database sessions**; `lib/auth.ts`; chặn route chưa đăng nhập
- [ ] Chặn tại `signIn` callback: allowlist `AllowedUser` (kiểm `email_verified`, `revokedAt = null`); seed **admin** (`canInvite = true`)
- [ ] Schema + migration: `User`, `AllowedUser`, `Holding`, `Cashflow` + enum `AssetType`, `CashflowType`
- [ ] Tách dữ liệu theo user: mọi query filter theo `userId` từ session; gom vào `queries.ts`
- [ ] Nhập vị thế ban đầu: empty state + form (có nút "Lưu & thêm mã khác") → tạo `Holding` + `Cashflow` BUY tại ngày mốc
- [ ] CRUD giao dịch mua/bán (`Cashflow`); giá vốn bình quân gia quyền (derived); mã cổ phiếu gõ tự do
- [ ] Trang danh sách danh mục: mã, số lượng, giá vốn, tổng vốn đã bỏ vào

## Tiêu chí hoàn thành
- [ ] Đăng nhập bằng Google; **chỉ email trong allowlist** vào được; thu hồi (`revokedAt` + xóa Session) mất quyền ngay
- [ ] Nhập được vị thế + giao dịch cho **cả 4 loại**; số lượng & giá vốn bình quân tính đúng
- [ ] Mỗi user **chỉ thấy dữ liệu của mình** (kiểm chứng bằng 2 tài khoản)
- [ ] `pnpm lint` + `typecheck` pass; khung Vitest/Playwright dựng xong
- [ ] Deploy được lên Vercel + Neon (hoặc chạy local qua docker/pnpm dev)

## Phụ thuộc / ghi chú
- Chức năng **mời có phân quyền + giới hạn `MAX_MEMBERS`** cần bảng `Setting` (Phase 5) — Phase 1 chỉ làm allowlist gate + cột `canInvite` + admin seed; UI mời có thể để sau khi có `Setting`.
