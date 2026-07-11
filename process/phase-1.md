# Phase 1 — Nền tảng + đăng nhập + nhập vị thế ban đầu

## Mục tiêu
Dựng nền tảng chạy được: đăng nhập Google (chỉ người được mời), tách dữ liệu theo user, nhập vị thế đang giữ và CRUD giao dịch mua/bán cho cả 4 loại tài sản. **Chưa có định giá thị trường / XIRR / biểu đồ** (thuộc Phase 2+).

## Công việc cần làm
- [x] Scaffold Next.js + TypeScript (App Router), **pnpm**, cấu trúc `src/`
- [x] Tailwind + shadcn/ui; ESLint + Prettier; husky + lint-staged; `tsconfig` strict + `noUncheckedIndexedAccess`
- [x] Prisma + kết nối **Neon**; `lib/db.ts` (singleton); `lib/logger.ts` (pino); `.env.example`
- [x] Auth.js + Google OAuth; **database sessions**; `lib/auth.ts`; chặn route chưa đăng nhập
- [x] Chặn tại `signIn` callback: allowlist `AllowedUser` (kiểm `email_verified`, `revokedAt = null`); seed **admin** (`canInvite = true`)
- [x] **Bảng `Setting`** (hạ tầng cấu hình) + enum `SettingValueType` + `resolveSetting(key, atDate)` + `prisma/seed.ts` (seed `MAX_MEMBERS`; các key thuế seed sẵn để dùng ở Phase 4/5) — `resolveSetting` + seed `MAX_MEMBERS` xong. Key thuế (`SALE_TAX_*`, `DIVIDEND_TAX_RATE`) **cố ý chưa seed**: Phase 1 không đọc key nào (phí/thuế nhập tay per-giao-dịch), và mức thuế suất cụ thể còn là điểm mở chưa xác nhận (`docs/03-roadmap.md` Phase 5) — seed khi có giá trị thật ở Phase 5.
- [x] **Mời có phân quyền:** user `canInvite` mời được (insert `AllowedUser`, người mới `canInvite = false`); giới hạn bằng `MAX_MEMBERS` (đếm `AllowedUser` chưa thu hồi)
- [x] Schema + migration: `User`, `AllowedUser`, `Setting`, `Holding`, `Cashflow` + enum `AssetType`, `CashflowType`, `SettingValueType`
- [x] Tách dữ liệu theo user: mọi query filter theo `userId` từ session; gom vào `queries.ts` — áp dụng cho `features/members` và `features/holdings`
- [x] Nhập vị thế ban đầu: empty state + form (có nút "Lưu & thêm mã khác") → tạo `Holding` + `Cashflow` BUY tại ngày mốc
- [x] CRUD giao dịch mua/bán (`Cashflow`); **find-or-create Holding** theo `(userId, symbol, type)` (`@@unique`) — mua trùng mã tự gộp; giá vốn bình quân gia quyền (derived); mã cổ phiếu gõ tự do
- [x] Trang danh sách danh mục (chỉ **vị thế đang mở**, SL>0): mã, số lượng, giá vốn, tổng vốn đã bỏ vào
- [x] **PWA (cài lên màn hình chính):** `app/manifest.ts` + icon (`scripts/generate-pwa-icons.mjs`, sinh từ `LogoMark`) + service worker viết tay (`public/sw.js`, chỉ đăng ký ở production) cache tài nguyên tĩnh + fallback `public/offline.html`. Không cache số liệu tài chính — xem [`04-tech-stack.md`](../docs/04-tech-stack.md#pwa-cài-lên-màn-hình-chính)

## Tiêu chí hoàn thành
- [x] Đăng nhập bằng Google; **chỉ email trong allowlist** vào được; thu hồi (`revokedAt` + xóa Session) mất quyền ngay — kiểm chứng bằng session giả lập cục bộ (chưa test round-trip Google OAuth thật, cần `GOOGLE_CLIENT_ID`/`SECRET` thật)
- [x] User `canInvite` mời được người khác; đạt `MAX_MEMBERS` thì bị chặn; `resolveSetting` trả đúng giá trị theo ngày
- [x] Nhập được vị thế + giao dịch cho **cả 4 loại** (`AssetType` không ràng buộc UI riêng theo loại — form dùng chung); số lượng & giá vốn bình quân tính đúng — kiểm chứng bằng `lib/cost-basis.test.ts` (đúng ví dụ FPT trong domain doc) + e2e `e2e/holdings.spec.ts`
- [x] Mỗi user **chỉ thấy dữ liệu của mình** (kiểm chứng bằng 2 tài khoản) — kiểm chứng cho cả mời thành viên và Holdings (`e2e/holdings.spec.ts` "cách ly dữ liệu giữa hai tài khoản": tài khoản B không thấy vị thế của tài khoản A, truy cập trực tiếp URL trả 404)
- [x] `pnpm lint` + `typecheck` pass; khung Vitest/Playwright dựng xong — `pnpm typecheck/lint/test/build` đều pass; `e2e/holdings.spec.ts` (3 test) + `e2e/smoke.spec.ts` chạy được cục bộ
- [x] Cài được lên màn hình chính (Chrome/Android + Safari/iOS): manifest hợp lệ (`/manifest.webmanifest`, icon 192/512/maskable), service worker đăng ký + activate ở production build — kiểm chứng bằng Playwright (mở `/sign-in` qua `next start`, xác nhận `link[rel=manifest]` + `serviceWorker.ready` activated) và test offline (ngắt mạng → điều hướng trả về `offline.html`, không phải lỗi trình duyệt)
- [ ] Deploy được lên Vercel + Neon (hoặc chạy local qua docker/pnpm dev)

## Phụ thuộc / ghi chú
- **Bảng `Setting` được tạo ở Phase 1** (chuyển sớm từ Phase 5) vì là hạ tầng cấu hình mà access control (`MAX_MEMBERS`) và cổ tức (`DIVIDEND_TAX_RATE`) đều cần. Phase 5 chỉ còn **áp dụng thuế bán**, không tạo bảng.
