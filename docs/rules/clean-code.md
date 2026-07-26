# Clean code — nguyên tắc xuyên suốt

Quy tắc **cắt/gộp code** dùng chung cho mọi tầng của Navtrack (`actions.ts`, `queries.ts`, `repository.ts`, `lib/`, component). Quy tắc riêng từng mảng ở các file còn lại trong `docs/rules/` — file này chỉ nói thứ áp cho tất cả.

Bối cảnh ra đời: rà toàn bộ tầng action/queries (Phase 1-7) phát hiện ~3.000 dòng với 9 hàm dài trên 100 dòng, 8 bản sao của cùng một khối `select`, 3 cài đặt song song của cùng một công thức, và 8 comment kiểu "xem ghi chú tương tự ở chỗ khác". Toàn bộ chuỗi bug issue #59 / `DECISION.md` 2026-07-24 đều thuộc **một** loại nguyên nhân: cùng một tri thức nằm ở nhiều chỗ.

---

## 1. Quy tắc số 1: phân biệt **lặp tri thức** và **lặp hình dạng**

DRY nguyên bản (Hunt & Thomas) nói về *tri thức*, không phải về *ký tự*:

> *"Every piece of **knowledge** must have a single, unambiguous, authoritative representation within a system."*

Hai đoạn code **giống nhau** không có nghĩa chúng **cùng một tri thức**. Câu hỏi đúng không phải "hai đoạn này có giống nhau không" mà là:

> **Đổi cái này có buộc phải đổi cái kia để hệ vẫn đúng không?**

- **Có** → lặp tri thức → **gộp ngay**, không chờ đủ 3 lần.
- **Không** (chỉ tình cờ giống) → lặp hình dạng → **để yên**. Gộp vào là tạo coupling giả, sau này hai bên phân kỳ thì abstraction vỡ.

Với lặp hình dạng, áp **AHA (Avoid Hasty Abstractions)** / Rule of Three: chờ đến lần thứ ba mới gộp. *"Prefer duplication over the wrong abstraction"* — xoá code lặp thì dễ, gỡ một abstraction sai thì phải sửa mọi nơi phụ thuộc nó.

### Thang độ mạnh (connascence) — dùng để xếp ưu tiên

Khi có nhiều chỗ lặp, sửa theo thứ tự mạnh → yếu, đừng sửa theo thứ tự dễ:

| | Mức | Nghĩa | Ví dụ |
|---|---|---|---|
| **Static** | Name | Cùng phải biết một cái tên | Nhiều action cùng gọi `getSession()` |
| | Type | Cùng phải biết một kiểu | Cùng nhận `CashflowInputWithEvent` |
| | **Meaning** | Cùng phải **hiểu ngầm** một quy ước | "Vị thế phải gồm cả cổ tức CP" giữ bằng comment `// Issue #59` |
| | Position | Cùng phải biết một thứ tự | Tie-break `(date, createdAt, id)` |
| | **Algorithm** | Cùng phải cài một công thức | `derivePosition()` bị chép lại bằng SQL/inline |
| **Dynamic** | Execution / Timing / **Value** / Identity | Ràng buộc lúc chạy | Hằng `new Date(8640000000000000)` khai ở 2 file, 2 tên |

**Mọi mức dynamic đều mạnh hơn mọi mức static.** Connascence of Value ở hai file khác nhau là mức nguy hiểm nhất thường gặp trong repo này — và cũng là mức trông vô hại nhất.

```ts
// ❌ Bad — Connascence of Value: cùng một hằng số, hai tên, hai file, ràng nhau bằng comment
// features/holdings/actions.ts
const CANDIDATE_CREATED_AT = new Date(8640000000000000); // "cùng pattern PROBE_CREATED_AT"
// features/dividends/actions.ts
const PROBE_CREATED_AT = new Date(8640000000000000);

// ✅ Good — một nguồn sự thật, tên nói đúng ý nghĩa
// lib/position-trail.ts
/** createdAt xa nhất có thể — sự kiện ĐANG XỬ LÝ luôn xếp sau cùng khi trùng ngày. */
export const PENDING_EVENT_CREATED_AT = new Date(8640000000000000);
```

```ts
// ❌ Bad — Connascence of Algorithm: quy tắc delta cài lại bằng tay ở call site
const events = holding.cashflows.map((cf) => ({
  id: cf.id, date: cf.date, createdAt: cf.createdAt,
  delta: cf.type === "BUY" ? qty(cf) : qty(cf).neg(),   // bản sao của derivePosition()
}));

// ✅ Good — gọi hàm đã sở hữu công thức, không chép lại
const events = buildPositionEvents({ cashflows: holding.cashflows, dividends: holding.dividends });
```

### Giới hạn phải thừa nhận

Có những đầu dây nằm **ngoài tầm với của compiler** — SQL trong migration, job Python, chuỗi trong e2e. Ở đó không gộp được, chỉ **tránh tạo ra**:
- Công thức nghiệp vụ **không** được viết lại bằng SQL — xem [`schema.md`](./schema.md#backfill-dữ-liệu-dẫn-xuất).
- Python và TS chỉ chia sẻ schema Postgres, không chia sẻ công thức — xem [`project-structure.md`](./project-structure.md).

---

## 2. Ba tầng type: `Row → Domain → DTO`

Một hàm không được vừa truy vấn, vừa tính domain, vừa format hiển thị. Ba việc này đổi vì ba lý do khác nhau — đổi cách hiển thị không nên phải mở hàm có câu truy vấn.

```
Row (Prisma)          Domain (Decimal, thuần)        DTO (string, cho màn hình)
  repository.ts    →     lib/*.ts + tính toán     →       queries.ts
  chạm DB              không I/O, test được            format, serialize
  check userId                                       Decimal → string
```

| Tầng | File | Được làm | Cấm |
|---|---|---|---|
| **Row** | `features/*/repository.ts` | Prisma, `select`, filter `userId`, nhận `tx` | Format, tính domain |
| **Domain** | `lib/*.ts` | Toán `Decimal`, quy tắc nghiệp vụ | I/O, `db`, `getSession`, `format*` |
| **DTO** | `features/*/queries.ts` | Ghép + format + `Decimal.toString()` | Gọi Prisma trực tiếp |

Dấu hiệu vi phạm, grep được: **một file import cả `@/lib/db` lẫn `@/lib/format`**. Nó đang gánh ít nhất hai tầng.

Ràng buộc kỹ thuật cứng của biên server→client (RSC): chỉ truyền được primitive / plain object / array / `Date`. **Không** `Prisma.Decimal`, không class, không `Map`/`Set`, không hàm. Quy ước `Decimal → string` (không phải `number`): xem [`data-prisma.md`](./data-prisma.md#prisma-client--serialization).

---

## 3. Functional Core / Imperative Shell

Navtrack đã theo pattern này (`lib/*.ts` thuần + có test; `actions.ts`/`queries.ts` là vỏ bẩn) — quy tắc dưới đây để giữ nó không xói mòn.

- **Core (thuần):** không I/O, không `Date.now()`, không random. Cùng input luôn cùng output ⇒ test không cần DB.
- **Shell (bẩn):** DB, session, `revalidatePath`, `redirect`. Giữ **mỏng** — chỉ điều phối, không chứa quyết định nghiệp vụ.

Tiêu chí máy móc để biết code mới viết vào đâu: **hàm này có I/O không?** Có → shell. Không → core, và **phải có `.test.ts`**.

```ts
// ❌ Bad — 80 dòng logic thuần bị nhốt trong vỏ bẩn, không test được nếu không có DB
export async function recordDividend(_prev, formData) {
  const result = await db.$transaction(/* ... */);
  const paymentDateFields = /* ... */;   // ─┐
  const priceAdjustmentFields = /* ... */; //  ├─ thuần: chỉ ghép object từ result
  const xirrFields = /* ... */;            // ─┘
  if (result.type === "CASH") return { ok: true, result: { /* 15 field */ } };
  return { ok: true, result: { /* 18 field */ } };
}

// ✅ Good — phần thuần rút ra, test được ngay, không cần Docker
export function buildDividendFormState(input: RecordedDividend): DividendFormState { /* thuần */ }

export async function recordDividend(_prev, formData) {
  const result = await db.$transaction(/* ... */);
  if (!result.ok) return result;
  return buildDividendFormState(result);
}
```

Hệ quả về test: xem [`testing.md`](./testing.md#tách-core-thuần-ra-khỏi-vỏ-bẩn-để-test-được).

---

## 4. Kích thước hàm & độ lồng

**Không đặt giới hạn số dòng.** Luật "hàm phải thật ngắn" của *Clean Code* là phán đoán thẩm mỹ, không có cơ sở thực nghiệm; tương quan giữa số dòng và mật độ bug thấp. Thứ **có** kiểm chứng thực nghiệm là **Cognitive Complexity** — nó phạt **lồng nhau và ngắt mạch đọc tuyến tính**, không phạt độ dài.

Tách hàm khi có **một trong hai** dấu hiệu:

1. **Nhiều hơn một trách nhiệm** (mục 2) — vừa truy vấn, vừa tính, vừa format.
2. **Lồng rẽ nhánh ≥ 4 cấp** — chỉ đếm `if`/`for`/`while`/`switch`/`try`, **không** đếm độ lồng của literal dữ liệu.

Hàm **dài nhưng tuyến tính và một trách nhiệm** thì để yên. Tách nó chỉ để đạt ngưỡng dòng là làm hại: thêm điểm gọi mà không giảm thứ gì phải hiểu.

Phân biệt hai loại "trông có vẻ phức tạp" — chúng cần hai cách chữa khác nhau:

```ts
// Lồng GIẢ — 7 cấp ngoặc, nhưng toàn là cây `select` dữ liệu, 2 cấp rẽ nhánh.
// Chữa bằng cách trích select shape ra hằng số dùng chung, KHÔNG đụng luồng điều khiển.
const holding = await tx.holding.findUnique({
  where: { id }, select: { cashflows: { select: { /* ... */ }, orderBy: [/* ... */] } },
});

// Lồng THẬT — rẽ nhánh chồng rẽ nhánh. Chữa bằng early return / tách hàm theo nhánh.
if (type === "CASH") { if (!skip) { const p = await f(); if (p) { const n = g(p); if (n) { /* ... */ } } } }
```

Lượng hoá bằng lint (đặt ngưỡng theo baseline hiện tại rồi siết dần, đừng bật ở mức lý tưởng rồi phải tắt):

| Rule | Dùng? | Lý do |
|---|---|---|
| `sonarjs/cognitive-complexity` | ✅ | Metric duy nhất có kiểm chứng thực nghiệm |
| `max-depth` | ✅ | Đúng dấu hiệu (2) — bỏ qua literal |
| `max-lines-per-function` | ❌ | Đo sai thứ: bắt oan hàm dài-tuyến-tính, bỏ lọt hàm ngắn-rối |
| `complexity` (cyclomatic) | 🟡 | Đo testability, không đo readability |

---

## 5. Comment

Giữ nguyên văn hoá comment dày của repo — nhưng phân biệt ba loại, vì chúng có giá trị hoàn toàn khác nhau:

| Loại | Ví dụ | Xử lý |
|---|---|---|
| **Giải thích "vì sao"** — lý do nghiệp vụ, lịch sử bug, đánh đổi đã cân nhắc | `cost-basis.ts` kể 4 lần sửa của issue #59 | ✅ **Giữ và viết thêm.** Tri thức này không suy ra được từ code; xoá là mất vĩnh viễn |
| **Thay thế cơ chế** — comment là thứ **duy nhất** ép một bất biến | `// Issue #59: xem ghi chú tương tự ở createHolding` (4 bản) | 🔴 **Mùi nặng.** Chuyển thành ràng buộc kiểu, rồi comment mới còn giá trị |
| **Kể lại code đang làm gì** | `// gán biến x bằng y` | 🟡 Thừa, bỏ khi đi ngang qua |

Dấu hiệu nhận biết loại 2, đếm được bằng grep:

> **Comment trỏ sang chỗ khác** — *"xem ghi chú ở X"*, *"khớp với Y"*, *"cùng pattern Z"* — **là bằng chứng của lặp tri thức**, không phải tài liệu. Nó đang làm thủ công đúng việc mà compiler nên làm.

```ts
// ❌ Bad — comment là cơ chế thực thi duy nhất, lặp ở 4 nơi
// Issue #59: nhớ kèm cả dividends STOCK, nếu không cache ghi đè mất
dividends: { where: { type: "STOCK" }, select: { /* ... */ } },

// ✅ Good — bất biến nằm trong type; quên là lỗi compile, comment quay về đúng vai giải thích
/** Nguồn tính vị thế: Cashflow + cổ tức CP. Tách rời hai vế là sai (issue #59). */
export const positionSourceSelect = { cashflows: /* ... */, dividends: /* ... */ } satisfies Prisma.HoldingSelect;
```

---

## Tra nhanh

| Tình huống | Làm gì |
|---|---|
| Thấy hai đoạn giống nhau | Hỏi "đổi cái này có buộc đổi cái kia không?" — không thì để yên |
| Lặp tri thức | Gộp ngay, không chờ Rule of Three |
| Lặp hình dạng | Chờ đủ 3 lần |
| Hàm 200 dòng, 1 cấp rẽ nhánh, 1 trách nhiệm | Để yên |
| Hàm 80 dòng, 5 cấp rẽ nhánh | Tách |
| Hàm import cả `db` lẫn `format*` | Tách theo 3 tầng (mục 2) |
| Muốn viết comment "xem thêm ở X" | Dừng — đó là lặp tri thức, gộp trước đã |
| Viết hàm thuần mới | Bắt buộc kèm `.test.ts` |
