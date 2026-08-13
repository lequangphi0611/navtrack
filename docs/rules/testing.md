# Testing

Chiến lược test cho Navtrack: tập trung vào **logic đúng** (nhất là tính tiền), không test UI.

## Unit test — chỉ test logic

- Dùng **Vitest**.
- Chỉ test **logic thuần**, không test render/UI của component. Ưu tiên:
  - Tính **XIRR** (`lib/xirr.ts`) — gồm ca biên: chuỗi dòng tiền không hợp lệ, không hội tụ, kỳ ngắn.
  - Toán tiền/`Decimal` (tổng vốn, lãi/lỗ, thuế).
  - Helper format (`lib/format.ts`), gồm chế độ ẩn số tiền.
  - Zod schema (`schemas.ts`).
- **Bắt buộc test XIRR đối chiếu** với kết quả XIRR của Excel/Google Sheets trên bộ dữ liệu mẫu.
- Đặt file test colocate cạnh file logic: `xirr.ts` → `xirr.test.ts`.

```ts
// ✅ Good — test logic thuần, có ca biên + đối chiếu spreadsheet
import { computeXirr } from "./xirr";

test("XIRR khớp Google Sheets trên dữ liệu mẫu", () => {
  const result = computeXirr([
    { date: new Date("2023-01-01"), amount: new Decimal(-100_000_000) },
    { date: new Date("2024-01-01"), amount: new Decimal(112_000_000) },
  ]);
  expect(result.ok).toBe(true);
  expect(result.annualizedRate).toBeCloseTo(0.12, 4); // Google Sheets XIRR = 12%
});

test("Không tính được khi thiếu dòng tiền dương", () => {
  const result = computeXirr([
    { date: new Date("2023-01-01"), amount: new Decimal(-100) },
  ]);
  expect(result.ok).toBe(false); // KHÔNG âm thầm trả -100%
});
```

## Tách core thuần ra khỏi vỏ bẩn để test được

Hiện trạng cần giữ và cần sửa: **17/26 file `lib/` có unit test**, nhưng `features/*/actions.ts` và `features/*/queries.ts` có **0 test** — toàn bộ ~3.000 dòng đó chỉ được phủ bởi `pnpm e2e`. `pnpm e2e` chạy được trên cả Claude Local (Docker) lẫn Claude Cloud (Postgres native — cần environment đã cấu hình setup script cài Postgres, xem `TOOLS.md`); phiên Cloud nào chưa cấu hình vẫn là phiên không có lưới an toàn ở tầng này, không phải mọi phiên Cloud như trước.

Cách xử **không phải** viết unit test cho action bằng cách mock Prisma — mock DB bắt được lỗi gõ sai nhưng bỏ lọt đúng thứ hay hỏng (vi phạm constraint, quan hệ sai, query sai), và mock lệch còn tạo test xanh giả.

Cách đúng theo Functional Core / Imperative Shell ([`clean-code.md`](./clean-code.md#3-functional-core--imperative-shell)):

- **Rút phần thuần ra khỏi action** cho tới khi phần còn lại mỏng đến mức không còn gì để test. Phần rút ra là hàm thuần ⇒ test bằng Vitest, không cần DB, chạy được mọi hạ tầng.
- **Không viết test cho vỏ mỏng** (`persistPosition`, `triggerManualSnapshot`, wrapper `revalidatePath`) — test chúng là test Prisma/Next, không phải test Navtrack.
- **Luồng thật đi qua DB** vẫn thuộc phạm vi e2e, không cố mô phỏng bằng unit test.

```ts
// ❌ Bad — mock db để test action; xanh nhưng không chứng minh được gì về DB thật
vi.mock("@/lib/db", () => ({ db: { holding: { findUnique: vi.fn() } } }));

// ✅ Good — rút phần thuần ra rồi test thẳng nó
test("cổ tức CP làm tròn xuống thì báo wasRounded", () => {
  expect(buildDividendFormState({ /* ... */ }).result.wasRounded).toBe(true);
});
```

Tiêu chí máy móc: **hàm thuần mới viết ra thì bắt buộc có `.test.ts` colocate**; hàm có I/O thì không.

## Không test UI

```ts
// ❌ Bad — không viết test render/snapshot cho component
render(<HoldingTable rows={[]} />);
expect(screen.getByText("...")).toBeInTheDocument();
```

- UI được phủ gián tiếp qua end-to-end.

## End-to-end — Playwright

- Dùng **Playwright** cho các luồng chính: đăng nhập Google, nhập vị thế ban đầu, ghi giao dịch, xem dashboard, bật/tắt ẩn số tiền.
- Đặt trong thư mục `e2e/` riêng, spec (`*.spec.ts`) nằm ở `e2e/tests/`.
- **Cách viết: theo Page Object Model** — quy ước đầy đủ (ba tầng page object/fixture/spec, chiến lược selector, URL & redirect, anti-pattern) ở [`e2e-page-object.md`](./e2e-page-object.md); instruction lúc thao tác + bẫy đã gặp ở [`../../e2e/CLAUDE.md`](../../e2e/CLAUDE.md) và [`../../e2e/GOTCHAS.md`](../../e2e/GOTCHAS.md).
- **DB riêng, ephemeral, tách khỏi DB dev:** trên Claude Local, `pnpm e2e` tự `docker compose -f docker-compose.test.yml up` một Postgres riêng (service `db-test`, cổng 5434, `.env.test`), áp migration, chạy test, rồi `down` khi xong — kể cả lúc fail. Trên Claude Cloud (không Docker), `pnpm e2e` dùng Postgres native đã cài sẵn qua setup script của environment (cấu hình ngoài repo, không chạy trong `pnpm e2e`), tự DROP + CREATE lại DB `navtrack` sạch mỗi lần chạy — xem README.md mục "Chạy e2e trên Claude Cloud". Không bao giờ chạy e2e nhắm vào DB dev (`.env`, cổng 5433 trên Local): tránh sinh data test lẫn vào data thật đang dùng để dev tay.

```ts
// ✅ Good — e2e/tests/dashboard.spec.ts (luồng thật, không mock logic)
test("ẩn số tiền che giá trị VND nhưng giữ phần trăm", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /ẩn số tiền/i }).click();
  await expect(page.getByTestId("nav-value")).toHaveText("••••••");
  await expect(page.getByTestId("xirr")).not.toHaveText("••••••");
});
```

## Soi UI qua preview + Playwright MCP — KHÔNG phải verify

Lớp UI có một bề mặt **preview dev-only** (`src/app/preview/`, xem [`component-architecture.md`](./component-architecture.md) mục "Bề mặt preview") để soi component cô lập qua browser (Playwright MCP). Đây là công cụ **self-check/khám phá lúc author** — giúp UI tự nhìn thành phẩm, **không** phải cổng verify:

- **Không** thay một e2e/unit test đã commit. Soi bằng mắt không lặp lại được, không chặn regression tự động.
- **Không** tick tiêu chí `phase-x.md` dựa trên "đã soi thấy đẹp". Việc tick thuộc `verifier`, dựa trên e2e + unit test thật.
- **Nguồn pass/fail vẫn là:** unit test (logic) + e2e Playwright (luồng người dùng). Soi chỉ bổ trợ ở khâu dựng UI.

## Integration test — job Python

Mỗi job Python (jobs/*/) cần thêm integration test chạy trên Postgres thật (ephemeral, tái
dùng docker-compose.test.yml) bên cạnh unit test mock — quy ước đầy đủ ở
docs/rules/python-job.md (mục "Test - unit + integration").
