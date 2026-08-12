# Quyết định — Người dùng, phân quyền & riêng tư

Phạm vi: allowlist/mời thành viên, `canInvite`, tách dữ liệu theo `userId`, chế độ ẩn số tiền.
Spec tương ứng: [`docs/domain/08-users-access-and-privacy.md`](../../docs/domain/08-users-access-and-privacy.md).

---

## 2026-07-10 — Phân quyền màn Thành viên: non-inviter không được lộ quota/allowlist

**Status:** Accepted

**Phân quyền màn Thành viên: user không có quyền mời không được lộ quota/danh sách allowlist.**
- Bất biến (bảo mật): non-inviter chỉ thấy `MembersDeniedScreen` (1 dòng từ chối), **không** lộ tổng số thành viên / danh sách allowlist / section mời; trang `/settings/members/invite` guard `canInvite` **phía server**, không chỉ ẩn UI.
- Cấu trúc: `/settings` (menu) ↔ `/settings/members` (danh sách) ↔ `/settings/members/invite` (form) tách 3 route (layout cũ gộp 1 màn quá dài).
- Docs đã sync: `docs/rules/ui-ux-design.md` (molecule `SettingsMenuItem`).

---

## Quyết định liên quan ở file khác

- **Chế độ ẩn số tiền — nút mắt header và toggle Settings cùng ghi `User.hideAmountsByDefault` ngay lập tức**, không có tầng "override phiên tạm thời": [`pricing-and-valuation.md`](./pricing-and-valuation.md), mục 2026-07-21 (2) điểm (1).
- Bất biến "cache key cho dữ liệu scoped-user phải gồm `userId` làm tham số hàm" (footgun rò dữ liệu giữa user) — [`architecture-and-code-quality.md`](./architecture-and-code-quality.md), mục 2026-07-11 (cache).
- Tầng `features/*/repository.ts` tự làm authorization, check `userId` một chỗ — [`architecture-and-code-quality.md`](./architecture-and-code-quality.md), mục 2026-07-26 điểm (3).
