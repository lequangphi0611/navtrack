# Data & Prisma

Quy tắc **truy vấn Prisma, tiền tệ, và tách dữ liệu theo user**. Cách *định nghĩa* model/schema (đặt tên, enum, quan hệ, timestamps, index, migration...) ở [`schema.md`](./schema.md).

## Tiền & số học

- Tiền và số lượng **luôn dùng `Decimal`**, không bao giờ `Float`. Chỉ định precision rõ ràng.

```prisma
// ❌ Bad — Float làm tròn sai tiền
model Cashflow { amount Float }

// ✅ Good — Decimal với precision rõ
model Cashflow { amount Decimal @db.Decimal(20, 4) }
```

- **Không** làm toán tiền bằng floating point trong JS. Dùng `Decimal` xuyên suốt.

```ts
// ❌ Bad — cộng tiền bằng number
const total = cashflows.reduce((s, c) => s + Number(c.amount), 0);

// ✅ Good — cộng bằng Decimal
const total = cashflows.reduce((s, c) => s.plus(c.amount), new Decimal(0));
```

- `Cashflow.amount` mang dấu sẵn (âm = mua, dương = bán). Ghi rõ quy ước này trong comment của schema.

## Bảo mật / tách dữ liệu theo user

- **Mọi truy vấn dữ liệu user PHẢI filter theo `userId` của phiên đăng nhập.**
- **Không tin `userId` từ client.** Luôn lấy từ session phía server qua helper `auth()` của Auth.js (`lib/auth.ts`).

```ts
// ❌ Bad — nhận userId từ client, lộ dữ liệu người khác
export async function getHoldings(userId: string) {
  return db.holding.findMany({ where: { userId } });
}

// ❌ Bad — không filter theo user, trả về toàn bộ
export async function getHoldings() {
  return db.holding.findMany();
}

// ✅ Good — lấy userId từ session, luôn filter
export async function getHoldings() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return db.holding.findMany({ where: { userId: session.user.id } });
}
```

- Với model **soft-delete** (vd `AllowedUser`), truy vấn phải lọc `revokedAt = null` (định nghĩa cột: xem `schema.md`).
- Gom truy vấn có kiểm soát quyền vào `queries.ts` của feature, không rải Prisma khắp nơi.

## Chọn `select` hẹp thay vì `include` full-row

- Khi chỉ cần vài field của quan hệ (vd tính lại vị thế từ cashflow chỉ cần `type/date/quantity/pricePerUnit`, không cần `amount/feeAmount/taxAmount/note`), dùng `select` hẹp trong Prisma thay vì `include` (kéo **toàn bộ field** của model quan hệ).
- Quan trọng nhất với quan hệ **1-nhiều tăng dần theo thời gian dùng app** (vd `Holding.cashflows`, lịch sử giao dịch) — `include` ở đây không chỉ dư field mà còn kéo payload phình vô hạn theo số giao dịch đã ghi, bất kể phía gọi có cần hiển thị hết hay không.
- Áp dụng cả trong action đọc để validate rồi ghi (không chỉ query hiển thị) — dữ liệu không ra client không có nghĩa là fetch rộng vô hại, vẫn tốn round-trip/băng thông DB.

```ts
// ❌ Bad — include kéo toàn bộ field cashflow (amount, feeAmount, taxAmount, note, id,
//          holdingId, createdAt, updatedAt...) chỉ để tính lại vị thế, phình theo lịch sử giao dịch
const holding = await db.holding.findUnique({
  where: { id: holdingId },
  include: { cashflows: true },
});
const position = derivePosition(holding.cashflows.map(toCashflowInput));

// ✅ Good — select đúng 4 field derivePosition cần
const holding = await db.holding.findUnique({
  where: { id: holdingId },
  select: {
    cashflows: {
      select: { type: true, date: true, quantity: true, pricePerUnit: true },
    },
  },
});
const position = derivePosition(holding.cashflows.map(toCashflowInput));
```

- Nếu nhiều vùng UI/Suspense độc lập đều cần dữ liệu dẫn xuất từ cùng 1 fetch (vd tổng vốn + danh sách vị thế đều cần replay cashflow), bọc fetch gốc bằng React `cache()` (như `getSession = cache(auth)` ở `lib/auth.ts`) và export các hàm mỏng chiếu từ kết quả cache — tránh mỗi vùng tự gọi lại fetch gốc, nhân đôi round-trip trong cùng một request.

## Materialized cache khi phải replay full history mỗi lần đọc

- `select` hẹp giảm **bề rộng** payload nhưng không giảm **số dòng**: nếu một giá trị dẫn xuất bắt buộc replay **toàn bộ** lịch sử (vd giá vốn bình quân di động có reset — mỗi lần đọc màn Danh mục phải kéo hết cashflow của **mọi** holding chỉ để suy ra vài con số), thì kể cả `select` hẹp vẫn phình theo lịch sử. Khi đã đo được đây là nút thắt, **materialize** kết quả thành cột trên bảng cha.
- **Bất biến bắt buộc (chống lệch dữ liệu):** cột materialized là **cache dẫn xuất**, không phải nguồn sự thật. Nó **chỉ** được ghi bằng cách **recompute lại từ nguồn** (không cộng/trừ tay) trong **cùng transaction** với **mọi** đường ghi làm đổi giá trị đó. Nguồn sự thật vẫn là bảng con (`Cashflow` + `Dividend{STOCK}`). Ví dụ: `Holding.quantity`/`avgCost` được `persistPosition` ghi từ `derivePosition(cashflows, stockDividends)` (`lib/cost-basis.ts` — hàm DUY NHẤT xử lý cả BUY/SELL lẫn cổ tức cổ phiếu) trong cả 4 action mua/bán (`features/holdings/actions.ts`); màn Danh mục (`queries.ts`) đọc thuần 2 cột này, không kéo cashflow.
- Rủi ro phải kiểm soát trước khi materialize: (1) **mọi** đường ghi ảnh hưởng giá trị phải đi qua chỗ recompute — quên một đường = lệch cache; (2) backfill dữ liệu cũ đúng 1 lần sau migration; (3) nếu backfill bằng SQL thuần là **bản sao** logic TS thì phải verify khớp và giữ đồng bộ khi logic đổi.
- **Ca thật đã xảy ra (issue #59):** khi thêm cổ tức cổ phiếu ở Phase 4/#52, đường ghi cổ tức (`recordDividend`) tự cộng đúng vào cache — nhưng **quên rằng cache còn 2 đường đọc/ghi KHÁC** (4 action mua/bán tính lại `quantity` từ đầu bằng một cài đặt chỉ-Cashflow, và `getHoldingDetail()` tự derive lại "vị thế tại cutoff") **không biết `Dividend{STOCK}`**, nên lần lượt: SL cổ tức bị **ghi đè mất** ở lần mua/bán tiếp theo, và trang chi tiết hiện SAI SL ngay cả khi chưa mua/bán gì thêm. Đúng như rủi ro (1) đã cảnh báo — "một đường ghi" ở đây thực ra là 3 đường (ghi cổ tức + 4 action mua/bán + 1 query đọc-rồi-derive-lại), quên mất 2/3 đường còn lại. Bài học: khi thêm một NGUỒN GHI MỚI cho giá trị đã materialize, phải rà **toàn bộ nơi recompute/derive lại giá trị đó** (không chỉ nơi ghi cache trực tiếp), không chỉ nơi vừa sửa. (Bài học tiếp theo, `process/DECISION.md` 2026-07-24 (4): giữ 2 cài đặt song song của cùng công thức — dù chỉ 1 bản còn sống trong test — cũng là nguồn lệch dữ liệu tiềm ẩn tương tự, đã gộp về 1 hàm `derivePosition()` duy nhất.)

## Race condition khi check-rồi-ghi (TOCTOU)

- Khi một action đọc dữ liệu để validate (vd "Holding đã tồn tại chưa", "còn slot mời không") rồi mới ghi, **đọc và ghi phải nằm trong cùng một `$transaction`**. Nếu tách rời, hai request đồng thời có thể cùng đọc thấy trạng thái cũ rồi cùng ghi, vi phạm bất biến (tạo trùng `Holding`, vượt `MAX_MEMBERS`).

```ts
// ❌ Bad — đọc để check nằm ngoài transaction: hai request đồng thời cùng thấy "chưa tồn tại"
const existing = await db.holding.findUnique({ where: { userId_symbol_type } });
const holdingId = await db.$transaction(async (tx) => {
  const holding = existing ?? (await tx.holding.create({ data: { ... } }));
  return holding.id;
});

// ✅ Good — đọc và ghi cùng một transaction
const holdingId = await db.$transaction(async (tx) => {
  const existing = await tx.holding.findUnique({ where: { userId_symbol_type } });
  const holding = existing ?? (await tx.holding.create({ data: { ... } }));
  return holding.id;
});
```

- Với bất biến dựa trên **đếm số lượng** (vd `activeCount < MAX_MEMBERS`), transaction mặc định (Read Committed) không đủ ngăn hai transaction cùng đọc count cũ rồi cùng ghi — dùng `{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }`.
- Dù đã bọc transaction, request thua trong đua tranh vẫn có thể gặp lỗi ở tầng DB (vi phạm unique constraint — mã `P2002`, hoặc serialization conflict — mã `P2034`). Đây là **lỗi lường trước được**, không phải bug: catch theo mã lỗi Prisma và trả `ActionResult` yêu cầu thử lại (xem [`error-handling.md`](./error-handling.md#phân-loại-lỗi)), không để throw ra `error.tsx`.

```ts
// ✅ Good — map race condition ở tầng DB sang ActionResult, không rethrow như bug
catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return { ok: false, error: "Có giao dịch trùng đang được xử lý, vui lòng thử lại" };
  }
  logger.error({ err }, "createHolding failed");
  throw err;
}
```

## Prisma client & serialization

- Prisma client **singleton** ở `lib/db.ts` (tránh cạn connection khi hot reload dev).

```ts
// ✅ Good — lib/db.ts singleton
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// ❌ Bad — new PrismaClient() mỗi file → cạn connection khi hot reload
export const db = new PrismaClient();
```

- `prisma/seed.ts` để seed giá trị mặc định (vd các dòng `Setting` cho thuế bán/cổ tức với `effectiveFrom` ban đầu).
- **Không truyền thẳng model Prisma ra client.** Convert `Decimal` → **`string`** (không phải `number`) tại biên server; **mọi toán tiền chỉ làm ở server bằng `Decimal`**, client chỉ hiển thị.

```ts
// ❌ Bad — trả Decimal thô (không serialize sạch) hoặc number (mở đường tính float ở client)
return { marketValue: holding.marketValue };          // Decimal
return { marketValue: holding.marketValue.toNumber() }; // number

// ✅ Good — string
return { marketValue: holding.marketValue.toString() };
```

> Migration discipline (mỗi thay đổi một migration, không sửa migration đã áp, commit file): xem [`schema.md`](./schema.md).
