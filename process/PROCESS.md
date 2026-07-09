# PROCESS — theo dõi tiến trình triển khai

File này theo dõi tiến độ implement Navtrack theo phase. **Mỗi khi hoàn thành một phase, Claude cập nhật bảng trạng thái dưới đây** và tick tiêu chí hoàn thành trong file `phase-x.md` tương ứng.

Trạng thái: ⬜ Chưa bắt đầu · 🟨 Đang làm · ✅ Hoàn thành

| Phase | Tên | Trạng thái | Chi tiết |
|---|---|---|---|
| 1 | Nền tảng + đăng nhập + nhập vị thế | 🟨 | [phase-1.md](./phase-1.md) |
| 2 | Lõi XIRR + giá tự động | ⬜ | [phase-2.md](./phase-2.md) |
| 3 | Snapshot tự động | ⬜ | [phase-3.md](./phase-3.md) |
| 4 | Cổ tức | ⬜ | [phase-4.md](./phase-4.md) |
| 5 | Thuế bán (áp dụng) | ⬜ | [phase-5.md](./phase-5.md) |
| 6 | Biểu đồ + hoàn thiện dashboard | ⬜ | [phase-6.md](./phase-6.md) |

## Cách dùng
- Bắt đầu một phase → đổi trạng thái sang 🟨, đọc `phase-x.md`.
- Hoàn thành → đổi ✅, tick hết tiêu chí trong `phase-x.md`, ghi ngày hoàn thành.
- Nếu phạm vi phase thay đổi, cập nhật cả `docs/03-roadmap.md` lẫn `phase-x.md` cho nhất quán.

## Nhật ký
- 2026-07-09: Phase 1 — xong Auth.js + Google OAuth + allowlist gate, `resolveSetting`, mời thành viên (`MAX_MEMBERS`). Còn lại: nhập vị thế + CRUD giao dịch mua/bán (Holdings/Cashflow).
- 2026-07-09: Phase 1 — xong `lib/format.ts`, `lib/cost-basis.ts` (giá vốn bình quân gia quyền), tính năng `features/holdings` (nhập vị thế ban đầu, CRUD giao dịch mua/bán, trang danh sách vị thế mở). Kiểm chứng bằng unit test + e2e (`e2e/holdings.spec.ts`) và cách ly 2 tài khoản. Còn lại duy nhất tiêu chí "Deploy lên Vercel + Neon" — chưa làm trong lần này.
