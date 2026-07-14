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

## Không test UI

```ts
// ❌ Bad — không viết test render/snapshot cho component
render(<HoldingTable rows={[]} />);
expect(screen.getByText("...")).toBeInTheDocument();
```

- UI được phủ gián tiếp qua end-to-end.

## End-to-end — Playwright

- Dùng **Playwright** cho các luồng chính: đăng nhập Google, nhập vị thế ban đầu, ghi giao dịch, xem dashboard, bật/tắt ẩn số tiền.
- Đặt trong thư mục `e2e/` riêng.
- **DB riêng, ephemeral, tách khỏi DB dev:** `pnpm e2e` tự `docker compose -f docker-compose.test.yml up` một Postgres riêng (service `db-test`, cổng 5434, `.env.test`), áp migration, chạy test, rồi `down` khi xong — kể cả lúc fail. Không bao giờ chạy e2e nhắm vào DB dev (`.env`, cổng 5433): tránh sinh data test lẫn vào data thật đang dùng để dev tay.

```ts
// ✅ Good — e2e/dashboard.spec.ts (luồng thật, không mock logic)
test("ẩn số tiền che giá trị VND nhưng giữ phần trăm", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /ẩn số tiền/i }).click();
  await expect(page.getByTestId("nav-value")).toHaveText("••••••");
  await expect(page.getByTestId("xirr")).not.toHaveText("••••••");
});
```
