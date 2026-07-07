# Error handling & logging

Cách xử lý lỗi và ghi log **thống nhất** cho Navtrack. Nguyên tắc: phân biệt lỗi lường trước với lỗi bất ngờ, không nuốt lỗi, không lộ chi tiết ra client, log có cấu trúc.

## Phân loại lỗi

- Tách rõ **lỗi lường trước** (validate, unauthorized, vi phạm nghiệp vụ) và **lỗi bất ngờ** (bug, DB chết).
- **Lỗi lường trước:** trả qua `ActionResult` union — **không throw**.
- **Lỗi bất ngờ:** cứ để throw → `error.tsx` của route bắt và hiển thị; đồng thời **log** lại.
- Dùng lớp lỗi có mã `AppError { code, message }` cho lỗi nghiệp vụ.

```ts
// ✅ Good — lỗi nghiệp vụ có mã, trả qua result (không throw ra UI)
export class AppError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export async function sellHolding(input: unknown): Promise<ActionResult<Trade>> {
  const parsed = sellSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", fieldErrors: toFieldErrors(parsed.error) };
  if (parsed.data.quantity > held) return { ok: false, error: "Bán quá số lượng đang giữ" };
  // ...
}

// ❌ Bad — throw lỗi lường trước ra UI, không mã, khó xử lý nhất quán
if (parsed.data.quantity > held) throw new Error("too much");
```

- **"XIRR không tính được" là kết quả nghiệp vụ, không phải lỗi** — trả status, không throw.

```ts
// ✅ Good
type XirrResult = { ok: true; annualizedRate: Decimal } | { ok: false; reason: "NO_POSITIVE_FLOW" | "NO_CONVERGE" };

// ❌ Bad — ném lỗi cho một kết quả hợp lệ về nghiệp vụ
if (!hasPositiveFlow) throw new Error("cannot compute xirr");
```

## Nguyên tắc xử lý

- **Không nuốt lỗi im lặng.** Cấm `catch {}` rỗng; đã catch thì phải log hoặc trả kết quả.

```ts
// ❌ Bad — nuốt lỗi
try { await savePrice(p); } catch {}

// ✅ Good — log rồi xử lý tiếp
try { await savePrice(p); }
catch (err) { logger.error({ err, symbol: p.symbol }, "savePrice failed"); }
```

- **Không lộ chi tiết nội bộ/stack ra client.** Thông điệp cho người dùng bằng **tiếng Việt**, rõ và có hướng xử lý.

```ts
// ❌ Bad — trả stack/nội bộ ra client
return { ok: false, error: err.stack };

// ✅ Good — thông điệp người dùng, log chi tiết riêng
logger.error({ err }, "addHolding failed");
return { ok: false, error: "Không lưu được. Thử lại sau ít phút." };
```

- Server action: **log lỗi bất ngờ trước khi** trả `error` chung chung cho client.

## Ghi log (pino)

- Một logger duy nhất `lib/logger.ts` dùng **pino** (log JSON có cấu trúc, có level). On Vercel log ra stdout được tự thu.

```ts
// ✅ Good — lib/logger.ts
import pino from "pino";
export const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

// dùng: object ngữ cảnh trước, message sau
logger.warn({ symbol, source: "SJC" }, "gold price source failed, using fallback");
```

- Level dùng khi nào:
  - `error` — lỗi bất ngờ (bug, DB chết)
  - `warn` — fallback, nguồn giá lỗi
  - `info` — sự kiện quan trọng (job chạy/xong)
  - `debug` — chi tiết khi dev
- Log **có ngữ cảnh** (tên action/job, `userId`, timestamp — pino tự thêm time).
- **Không log secret/token, không log `DATABASE_URL`.** Không spam log giá trị tài chính nhạy cảm khi không cần.

```ts
// ❌ Bad — lộ secret / dữ liệu nhạy cảm
logger.info({ databaseUrl: process.env.DATABASE_URL, session }, "connected");

// ✅ Good — chỉ ngữ cảnh cần thiết
logger.info({ userId, action: "addHolding" }, "holding created");
```

## Job Python

- Job Python dùng **logging của Python ra stdout** (GitHub Actions tự bắt) — pino là của TS, mỗi runtime một logger, cùng nguyên tắc.
- **Một mã lỗi không làm sập cả job:** log rồi tiếp tục mã khác.

```python
# ✅ Good — cô lập lỗi từng mã, không sập cả run
for symbol in symbols:
    try:
        save_price(fetch_price(symbol))
    except Exception:
        logging.exception("fetch failed for %s", symbol)  # log + tiếp tục
        continue

# ❌ Bad — một mã lỗi làm sập toàn bộ job, mất luôn các mã sau
for symbol in symbols:
    save_price(fetch_price(symbol))
```

- Log rõ **mã nào fetch fail** và **có dùng fallback không** (vd vàng/trái phiếu).
