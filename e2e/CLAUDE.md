# CLAUDE.md — lớp e2e (Playwright)

File này tự nạp khi làm việc trong `e2e/`. Giữ ngắn có chủ đích: chi tiết nằm ở 2 file
dưới, đọc **trước khi viết/sửa/chạy** bất kỳ e2e nào — đừng đoán từ trí nhớ.

## Bắt buộc đọc trước

1. [`../docs/rules/e2e-page-object.md`](../docs/rules/e2e-page-object.md) — **cách viết**:
   Page Object Model, ba tầng (page object / component object / fixture), chiến lược
   selector (role/label-first, repo có 0 `data-testid`), URL & redirect, đặt assertion ở đâu.
2. [`./GOTCHAS.md`](./GOTCHAS.md) — **bẫy đã gặp thật** (triệu chứng → nguyên nhân → fix):
   redirect `?cashflowId=`, DatePicker input hidden, timezone lệch ngày, race giữa worker,
   dọn `PriceQuote`... Gặp bẫy MỚI → **ghi thêm vào đây ngay** (kèm 1 dòng cách né).

## Cách chạy

- **Claude Local:** `pnpm e2e` (hoặc `pnpm e2e <file>`). Script `scripts/e2e.mjs` tự dựng
  Postgres ephemeral (`docker-compose.test.yml`, cổng 5434, `.env.test`), `prisma migrate
  deploy`, chạy test, rồi `down` — kể cả khi fail. **Không bao giờ** nhắm e2e vào DB dev.
- **Claude Cloud:** **skip** — cần Docker, không có ở Cloud. Báo rõ "chưa verify e2e được
  trong Claude Cloud", **không báo pass giả** (xem [`../TOOLS.md`](../TOOLS.md)).

## Bản đồ thư mục

```
pages/      # page object — 1 file/màn hình, giữ selector + action (kebab-case file, PascalCase class)
support/    # fixture cross-cutting: test-session (session+cleanup), dates, date-picker, urls
*.spec.ts   # spec — chỉ ý định người dùng + kỳ vọng, gọi page object
```

> Trạng thái: spec hiện tại viết lối thủ tục (có trước quy ước POM). Spec **mới** theo POM;
> refactor spec cũ được theo dõi ở issue riêng — đụng tới đâu POM hoá tới đó, không refactor
> ồ ạt làm vỡ test đang xanh.

## Luật vàng

- **Selector sống trong page object, không rải inline** — đổi UI thì sửa 1 nơi.
- **Không bám class CSS/Tailwind** làm selector; ưu tiên role/label/text; cần lắm mới đề
  xuất thêm `data-testid` vào `src/` (ngoại lệ có kiểm soát — xem rule mục 5).
- **e2e phủ luồng nối dây, không test lại logic thuần** — XIRR/cost basis/thuế thuộc unit
  test ([`../docs/rules/testing.md`](../docs/rules/testing.md)).
- **Bẫy mới → GOTCHAS.md** trong cùng lần commit.
