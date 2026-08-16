# DECISION — index quyết định quan trọng

Nơi ghi các **quyết định quan trọng** làm thay đổi business/domain/spec/data model/rules, hoặc root-cause một lỗi non-obvious mà bản thân code không giải thích được lý do. **Không ghi tiến độ thường ở đây** — tiến độ (đã làm gì, còn gì) thuộc về [`PROCESS.md`](./PROCESS.md).

## Cách dùng file này (2 tầng — đọc index luôn, mở chi tiết khi cần)

1. **Luôn đọc file này** (chỉ bảng index bên dưới) khi bắt đầu một phase mới, cùng `PROCESS.md` + `phase-x.md`. Mỗi quyết định 1 dòng — đủ để biết "đã có quyết định gì, còn hiệu lực không".
2. **Chỉ mở file chi tiết trong [`decisions/`](./decisions/)** khi việc đang làm chạm đúng chủ đề đó. Đừng đọc cả thư mục — mục đích của việc tách là để không phải nạp hết mọi lý do vào context.
3. **Tra theo ngày:** mọi entry giữ nguyên mốc `YYYY-MM-DD [(n)]` làm định danh. Comment trong `src/` trỏ kiểu `// process/DECISION.md 2026-07-12` vẫn đúng — chỉ cần `grep` mốc ngày đó trong `process/decisions/`.
4. **Ghi quyết định mới:** đọc [`decisions/CLAUDE.md`](./decisions/CLAUDE.md) (quy ước viết một entry + chọn file chủ đề).

> Chỉ giữ các quyết định **còn hiệu lực / còn ràng buộc việc sau**. Quyết định đã đóng mà code hoặc `docs/rules/*` đã tự giải thích được lược bỏ — lịch sử đầy đủ nằm trong git.

## Bản đồ chủ đề

Ranh giới chủ đề trùng với [`docs/domain/*`](../docs/domain/README.md) để không phải nhớ thêm một bản đồ mới: đang sửa `docs/domain/03-dividends.md` thì file quyết định tương ứng là `decisions/dividends.md`.

| File | Mở khi đang làm |
|---|---|
| [`decisions/transactions-and-cost-basis.md`](./decisions/transactions-and-cost-basis.md) | `Cashflow`, `avgCost`, `derivePosition()`, cache `Holding.quantity` |
| [`decisions/dividends.md`](./decisions/dividends.md) | cổ tức tiền mặt/cổ phiếu, bù pha loãng NAV |
| [`decisions/bonds-and-cashflow-calendar.md`](./decisions/bonds-and-cashflow-calendar.md) | `BondTerms`, trái tức, `MATURITY`, lịch coupon (Phase 7-8) |
| [`decisions/pricing-and-valuation.md`](./decisions/pricing-and-valuation.md) | `NavOverride`/`PriceQuote`, NAV, cảnh báo tập trung |
| [`decisions/returns-xirr-and-pnl.md`](./decisions/returns-xirr-and-pnl.md) | XIRR, `absolutePnl`, realized/unrealized |
| [`decisions/tax-and-fees.md`](./decisions/tax-and-fees.md) | thuế bán, phí giao dịch, chi phí ăn mòn |
| [`decisions/snapshots.md`](./decisions/snapshots.md) | `Snapshot`, cron chốt số liệu, lịch sử mốc |
| [`decisions/users-access-and-privacy.md`](./decisions/users-access-and-privacy.md) | allowlist, phân quyền, ẩn số tiền |
| [`decisions/architecture-and-code-quality.md`](./decisions/architecture-and-code-quality.md) | clean code, repository layer, component/enum rule, cache, PWA |
| [`decisions/agent-workflow-and-tooling.md`](./decisions/agent-workflow-and-tooling.md) | e2e infra, preview surface, DesignSync, gate tạo PR |
| [`decisions/roadmap-and-scope.md`](./decisions/roadmap-and-scope.md) | thêm/đổi phase, đưa ý tưởng vào roadmap |

Quyết định về `Setting` không có file riêng — nằm cùng chủ đề dùng nó (`DIVIDEND_PAR_VALUE` → dividends, `SALE_TAX_*`/`TRANSACTION_FEE_*` → tax-and-fees, `BOND_INTEREST_TAX_RATE_*` → bonds, `CONCENTRATION_WARNING_THRESHOLD` → pricing).

---

## Index quyết định

`A` = Accepted (còn hiệu lực) · `S` = Superseded (giữ lại để không lặp lại tranh luận cũ).

### Giao dịch & giá vốn → [`transactions-and-cost-basis.md`](./decisions/transactions-and-cost-basis.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-11 | Materialize `Holding.quantity`/`avgCost`; nguồn sự thật vẫn là `Cashflow`, ghi cache trong cùng transaction (#18) | A |
| 2026-07-16 (4) | Vị thế phải replay cả cổ tức cổ phiếu, không chỉ `Cashflow` (#59) | S → 07-24 (4) |
| 2026-07-24 (2) | "2 bộ đếm song song" cho `realizedPnl`; cờ `pnlSplitIsApproximate` | S → 07-24 (3) (điểm (b) vẫn A) |
| 2026-07-24 (3) | Một bộ đếm `realQuantity` duy nhất; `avgCost` chỉ đổi ở BUY | A |
| 2026-07-24 (4) | Xoá `derivePosition()` cũ, gộp về một hàm; reset `avgCost` khi `quantity = 0` | A |

### Cổ tức → [`dividends.md`](./decisions/dividends.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-16 | `DIVIDEND_PAR_VALUE`/`DIVIDEND_TAX_RATE` là Setting; cổ tức CP không đổi `avgCost`; SL-tại-ngày-ghi (#52) | S → 08-13 (điểm "avgCost giữ nguyên") |
| 2026-07-16 (2) | `floor(stockQuantity)` + `stockQuantityOverride`, tolerance 2 đơn vị | A |
| 2026-07-17 | Tự tạo `NavOverride` bù pha loãng NAV; thêm `Dividend.paymentDate` (#61) | A |
| 2026-07-17 (2) | Ghi cổ tức **không** trigger `Snapshot{MANUAL}` | A |
| 2026-07-17 (3) | `computeCashDividendPriceAdjustment` trả `null` khi giá điều chỉnh ra âm/0 ⚠️ nhãn trùng, xem ghi chú | A |
| 2026-08-13 | Bugfix: `avgCost` PHẢI dilute qua cổ tức cổ phiếu (đảo điểm "giữ nguyên" của 2026-07-16) + backfill production | A |

### Trái phiếu & lịch dòng tiền → [`bonds-and-cashflow-calendar.md`](./decisions/bonds-and-cashflow-calendar.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-25 (2) | Tách bảng `BondTerms`; `firstCouponDate` thay `nextCouponDate`; trái tức KHÔNG bù pha loãng NAV; 2 key thuế lãi theo `issuerType`; thêm `CashflowType.MATURITY`; rule enum | A (điểm (2) đảo ở 07-28 (3)) |
| 2026-07-28 (2) | Thứ tự sự kiện bằng `rank`; `BondTerms` thuộc feature holdings; route riêng `/bond-terms` | A (điểm (2) → S) |
| 2026-07-28 (3) | Kỳ trả lãi phải là **cột đóng băng** `couponFrequencyMonthsApplied`, không phải phép đảo công thức | A |
| 2026-07-29 | 3 lỗi đường ghi: sót call site XIRR, khoá-bằng-UI không phải khoá, prefill lệch cơ sở SL | A |
| 2026-08-08 | Override thủ công `grossAmount` + cờ `grossAmountOverridden`; guard `tax > gross` so số cuối cùng | A |

### Định giá & cảnh báo tập trung → [`pricing-and-valuation.md`](./decisions/pricing-and-valuation.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-12 | `NavOverride` `@@unique([holdingId, date])` + `@db.Date` | A |
| 2026-07-14 | Ưu tiên giá so **ngày** giữa `NavOverride`/`PriceQuote`, không "nhập tay luôn thắng" (#40) | A |
| 2026-07-21 | Materiality 5% cho `MISSING_PRICE`; ghi chú "ít mã"; hysteresis 3 điểm %; chú thích liên kết | A |
| 2026-07-21 (2) | Mockup Phase 6: `hideAmountsByDefault` ghi ngay; XIRR bình quân weighted | A |
| 2026-08-16 | Stock allocation drill-down (#131): route riêng `/allocation/stock`, không accordion | A |

### XIRR & lãi/lỗ → [`returns-xirr-and-pnl.md`](./decisions/returns-xirr-and-pnl.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-19 | Mốc dòng tiền XIRR của cổ tức = `paymentDate ?? date` (#65) | A |
| 2026-07-24 | Tách `realizedPnl`/`unrealizedPnl`; hàm mới thay vì mở rộng `derivePosition()` (#67) | A |

### Thuế, phí & chi phí ăn mòn → [`tax-and-fees.md`](./decisions/tax-and-fees.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-17 (3) | SELL prefill không khoá field; BUY bỏ hẳn field thuế; `SALE_TAX_GOLD = 0` ⚠️ nhãn trùng | A |
| 2026-07-17 (4) | Thêm "Chi phí ăn mòn" vào Phase 5 (gộp 3 nguồn chi phí) | A (mẫu số sửa ở (6)) |
| 2026-07-17 (6) | Mẫu số đổi `totalInvested` → `grossInvested` (`Σ|BUY.amount|`) | A |
| 2026-07-18 (2) | Sửa SELL đã ghi → **tính lại** thuế theo ngày mới; giữ sheet chi tiết cost drag | A |
| 2026-07-18 (4) | Phí tự tính qua `TRANSACTION_FEE_<chiều>_<LOẠI>` (8 key); đóng #66 — phí mua vào `avgCost` | A |
| 2026-07-18 (5) | `SALE_TAX_BOND = 0.1%`; nút "Đặt lại" cả 2 card; card phí vàng hiện `0 ₫` | A |

### Snapshot → [`snapshots.md`](./decisions/snapshots.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-14 | Dedup bằng 2 partial unique index raw SQL, không `@@unique` (#34) | A |
| 2026-07-14 | Job Python tự viết công thức định giá bằng SQL/Python, không gọi API route (#36) | A |
| 2026-07-15 (2) | Serializable + `findFirst` rồi create/update; re-chốt idempotent; `updatedAt` (#37) | A |
| 2026-07-15 (3) | Badge suy từ `period`; breakdown liên kết qua khoá dedup; ngưỡng 1 VND (#46) | A |

### Người dùng & riêng tư → [`users-access-and-privacy.md`](./decisions/users-access-and-privacy.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-10 | Non-inviter không được lộ quota/allowlist; guard `canInvite` phía server | A |

### Kiến trúc & chất lượng code → [`architecture-and-code-quality.md`](./decisions/architecture-and-code-quality.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-11 | PWA tối giản: không cache số liệu tài chính offline, SW viết tay | A |
| 2026-07-11 | Cache "có chọn lọc"; **cache key scoped-user phải gồm `userId` làm tham số** | A |
| 2026-07-11 | Chỉ tách Suspense khi tách được vật lý khỏi query (#12) | A |
| 2026-07-11 | BottomNav dùng chung màn gốc, không cho form/route con | A |
| 2026-07-12 | Cutoff qua cookie + Route Handler + hard nav | A |
| 2026-07-26 | 10 quy tắc clean code: connascence, tầng `repository.ts`, cognitive complexity, cấm SQL nghiệp vụ trong migration, core/shell test, ranh giới client/stream | A |
| 2026-07-28 | Cùng enum rẽ nhánh ≥3 chỗ trong 1 component → tách variant component | A |

### Quy trình agent & hạ tầng → [`agent-workflow-and-tooling.md`](./decisions/agent-workflow-and-tooling.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-14 | `pnpm e2e` chạy DB Postgres riêng ephemeral (`db-test`, tmpfs, cổng 5434) | A |
| 2026-07-15 | Integration test Python orchestrate bằng script Node, tái dùng compose test | A |
| 2026-07-18 | Bề mặt preview dev-only; chặn production ở `proxy.ts` không phải `notFound()` | A |
| 2026-07-18 | `design-fetcher` là owner duy nhất kéo mockup, sinh digest `UI_phase_N.md` | A (cơ chế đổi ở (3)) |
| 2026-07-18 (3) | Orchestrator gọi `DesignSync` rồi mới spawn `design-fetcher` (#76) | A |
| 2026-07-24 (5) | Page Object Model cho e2e; selector role/label-first, cấm bám class CSS | A |
| 2026-07-25 | Spec e2e chuyển vào `e2e/tests/` | A |
| 2026-08-12 | Từ chối Neon cho e2e trên Cloud; `issuer` bắt buộc biết trạng thái e2e, PR Draft khi chưa `ĐẠT` | A |
| 2026-08-13 | `pnpm e2e` chạy được trên Cloud qua Postgres native; cài đặt là setup script của environment, không nằm trong repo | A |

### Roadmap & phạm vi → [`roadmap-and-scope.md`](./decisions/roadmap-and-scope.md)

| Ngày | Quyết định | |
|---|---|---|
| 2026-07-16 (3) | Thêm Phase 7 (trái tức), ngoài trình tự ưu tiên gốc | A |
| 2026-07-17 (5) | Thêm cảnh báo tập trung (Phase 6) + lịch dòng tiền (Phase 8) | A |
| 2026-07-17 (7) | Chốt A2; log #65/#66/#67 sửa sau; B2 benchmark giữ Backlog | A (C1/C2/B1 đã đóng) |

---

## Ghi chú định danh

- **Nhãn `2026-07-17 (3)` bị dùng cho hai quyết định khác nhau** (lỗi có sẵn trong lịch sử file, giữ nguyên để không phá citation trong code): một ở [`dividends.md`](./decisions/dividends.md) (giá điều chỉnh âm/0 — đây là cái `docs/domain/03-dividends.md` đang trỏ tới), một ở [`tax-and-fees.md`](./decisions/tax-and-fees.md) (thảo luận thuế bán Phase 5).
- **`2026-07-21 (2)`** là nhãn thêm mới cho một sub-entry vốn không đánh số trong file gốc; citation cũ dạng `2026-07-21` vẫn đúng cho cả hai entry cùng ngày.
- Một số comment trong `src/` trỏ tới mốc ngày không tồn tại trong file (`2026-07-13`, `2026-07-15 (4)`, `2026-07-21 (1)`) — sai sẵn từ trước, không phát sinh do việc tách file.

## Việc còn treo (rút từ các entry)

- `NavOverrideForm` chưa có route thật; cutoff "Tuỳ chỉnh" (CUSTOM) chưa mockup — [architecture, 2026-07-11].
- B2 benchmark lãi suất tiết kiệm vẫn ở Backlog — [roadmap, 2026-07-17 (7)].
- #132: route `/allocation/stock` + `page.tsx`/`loading.tsx` thật cho `StockAllocationDetail`, đổi legend "Cổ phiếu" trong `AllocationScreen.tsx` thành `<Link>` — [pricing-and-valuation, 2026-08-16].

> Đã đóng 2026-08-13: gộp `getAllCashDividendsForXirr()`/`recordDividendSchema` discriminatedUnion/3 e2e trái tức — xem [`bonds-and-cashflow-calendar.md`](./decisions/bonds-and-cashflow-calendar.md).
