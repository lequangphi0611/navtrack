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
- Bắt đầu một phase → đổi trạng thái sang 🟨, đọc `phase-x.md` **và [`DECISION.md`](./DECISION.md)** (quyết định quan trọng đã chốt ở phase trước).
- Hoàn thành → đổi ✅, tick hết tiêu chí trong `phase-x.md`, ghi ngày hoàn thành.
- Nếu phạm vi phase thay đổi, cập nhật cả `docs/03-roadmap.md` lẫn `phase-x.md` cho nhất quán.

## Nhật ký

Ghi ngắn gọn **đã làm gì** — 1 dòng/lần. Quyết định quan trọng kèm lý do ghi ở [`DECISION.md`](./DECISION.md), không lặp lại chi tiết ở đây.

- 2026-07-09: Phase 1 — Auth.js + Google OAuth + allowlist + `resolveSetting` + mời thành viên xong.
- 2026-07-09: Phase 1 — nhập vị thế + CRUD giao dịch mua/bán xong (`features/holdings`); kiểm chứng unit test + e2e + cách ly 2 tài khoản.
- 2026-07-10: Phase 1 — đồng bộ UI theo mockup "Phase 1 Screens" (Claude Design): đăng nhập, danh mục, form vị thế/giao dịch, thành viên (6 màn).
- 2026-07-10: Phase 1 — thêm loading/skeleton, animation, dropdown đơn vị theo loại tài sản; fix schema `User` (AdapterError khi login Google thật) — xem [DECISION.md](./DECISION.md).
- 2026-07-10: Phase 1 — tách màn Cài đặt/Thành viên thành `/settings`, `/settings/members`, `/settings/members/invite` — xem [DECISION.md](./DECISION.md).
- 2026-07-10: Phase 1 — route/Setting key qua constants (`ROUTES`, `SETTING_KEYS`); tách nhật ký khỏi quyết định — xem [DECISION.md](./DECISION.md).
- 2026-07-11: Phase 1 — thêm PWA (manifest, icon, service worker, offline fallback) — xem [DECISION.md](./DECISION.md).
- 2026-07-11: Phase 1 — gom nhóm danh sách danh mục theo loại tài sản (mockup "Danh sách danh mục" cập nhật): card theo `AssetType` + mở rộng "Xem thêm N mã"; xoá `HoldingRow` cũ (thay bằng `HoldingsGroupCard`).
- 2026-07-11: **Phát hiện regression chưa rõ nguyên nhân** — `proxy.ts` (middleware) không nhận diện session hợp lệ: mọi route đã đăng nhập đều redirect về `/sign-in` kể cả khi cookie `authjs.session-token` trỏ đúng `Session` còn hạn trong DB (kiểm chứng bằng fetch trực tiếp, không qua Playwright) → `e2e/holdings.spec.ts` hiện fail ngay từ bước đầu, không phải do thay đổi gom nhóm danh mục (không đụng `auth.ts`/`proxy.ts`). Nghi vấn: Next.js 16 đổi runtime mặc định của middleware sang Edge, không gọi được Prisma cho `session: { strategy: "database" }`. **Cần điều tra riêng, chưa fix trong lần này.**
