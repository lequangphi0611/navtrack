# CLAUDE.md — lớp e2e (Playwright)

File này tự nạp khi làm việc trong `e2e/`. Giữ ngắn có chủ đích: chi tiết nằm ở 2 file
dưới, đọc **trước khi viết/sửa/chạy** bất kỳ e2e nào — đừng đoán từ trí nhớ.

## Bắt buộc đọc trước

1. [`../docs/rules/e2e-page-object.md`](../docs/rules/e2e-page-object.md) — **cách viết**:
   Page Object Model, ba tầng (page object / component object / fixture), chiến lược
   selector (role/label-first, repo có 0 `data-testid`), URL & redirect, đặt assertion ở đâu.
2. [`./GOTCHAS.md`](./GOTCHAS.md) — **bẫy đã gặp thật** (triệu chứng → nguyên nhân → fix):
   redirect `?cashflowId=`, DatePicker input hidden, timezone lệch ngày, race giữa worker,
   dọn `PriceQuote`... **Đọc bảng "Tra theo triệu chứng" ở đầu file rồi nhảy thẳng tới mục
   cần — đừng đọc cả file.** Mục đánh dấu `⛔` là đã hết hiệu lực, không làm theo. Gặp bẫy
   MỚI → **ghi thêm vào cuối file ngay** (số kế tiếp + 1 dòng vào bảng tra, cùng lần commit).

## Cách chạy

- **Claude Local:** `pnpm e2e` (hoặc `pnpm e2e <file>`). Script `scripts/e2e.mjs` tự dựng
  Postgres ephemeral (`docker-compose.test.yml`, cổng 5434, `.env.test`), `prisma migrate
  deploy` + `prisma db seed` (seed toàn bộ `Setting` toàn cục — xem GOTCHAS #15), chạy test,
  rồi `down` — kể cả khi fail. **Không bao giờ** nhắm e2e vào DB dev.
- **Claude Cloud:** **skip** — cần Docker, không có ở Cloud. Báo rõ "chưa verify e2e được
  trong Claude Cloud", **không báo pass giả** (xem [`../TOOLS.md`](../TOOLS.md)).
- **Log server khi fail:** mỗi lần `pnpm e2e` chạy, server (app log qua pino + SQL query
  qua Prisma) được ghi ra `.e2e-logs/server.log` (reset về 1 dòng marker `# e2e run started
  <timestamp>` mỗi lần, không cần dọn tay). Khi 1 test fail và error-context (screenshot/DOM
  snapshot) không đủ giải thích nguyên nhân, đọc thêm file này quanh mốc thời gian fail.
  **Chỉ có log khi Playwright tự spawn `pnpm dev` mới** — nếu `reuseExistingServer` (local,
  không CI) tái dùng 1 dev server đã chạy sẵn từ trước, server đó không có biến env log nên
  sẽ không ghi gì thêm. **File chỉ còn đúng dòng marker, không có log nào nối theo** là dấu
  hiệu của đúng trường hợp này — đừng hiểu nhầm thành "server không log gì" hay "chưa từng
  chạy". Muốn chắc chắn có log, tắt mọi `pnpm dev` đang chạy sẵn ở port 3000 trước khi chạy
  `pnpm e2e`.

## Bản đồ thư mục

```
tests/      # spec (*.spec.ts) — chỉ ý định người dùng + kỳ vọng, gọi page object
pages/      # page object — 1 file/màn hình, giữ selector + action (kebab-case file, PascalCase class)
support/    # fixture cross-cutting: test-session (session+cleanup), dates, date-picker, urls
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
