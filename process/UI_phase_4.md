# Phase 4 — UI/Presentational layer (design-implementer, issue #51)

Deliverable của agent `design-implementer` cho issue #51 ("Thiết kế & UI ghi
nhận cổ tức" — Phase 4). **Chỉ Presentational** — không business logic, không
`queries.ts`, không Server Action thật, không sửa `lib/xirr.ts`/Prisma. Mọi
Props dưới đây là **hợp đồng** mà `business-implementer` (issue #52) cần khớp
khi wiring dữ liệu thật.

Mockup nguồn: Claude Design project "Web app design mobile first"
(`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → `Phase 4 Screens.dc.html`, đủ 6 màn
4a-4f (Ghi cổ tức tiền mặt / chọn mã / cổ tức cổ phiếu / đã ghi / lịch sử /
menu nhanh Dashboard). Cache cục bộ tại
`.claude/design-cache/raw/Phase-4-Screens.dc.html` +
`.claude/design-cache/index.json`.

## QUAN TRỌNG — plan ban đầu ước lượng TRƯỚC KHI đối chiếu mockup thật

Plan được duyệt (mục "Việc cần làm") viết dựa trên nội dung issue #51, chưa
đối chiếu mockup. Sau khi kéo `Phase 4 Screens.dc.html`, một số cấu trúc thực
tế **khác** với ước lượng ban đầu — xem mục "Điểm lệch so với plan ban đầu"
bên dưới. Các ràng buộc nghiệp vụ cố định của issue #51 (input %, CTA "Ghi cổ
tức" cạnh "Thêm giao dịch", màn lịch sử tách riêng, switcher chỉ liệt kê
Holding đang mở) **vẫn được giữ nguyên** — chỉ cấu trúc route/component/vị trí
entry point thay đổi theo mockup thật.

## Tóm tắt trạng thái wiring

| Component | Route | Trạng thái wiring |
|---|---|---|
| `DividendForm` | `/holdings/[id]/dividends/new` (mới) VÀ `/dividends/new` (mới) | `page.tsx` hardcode sample data (5 Holding mẫu) — chờ `getOpenHoldingsForDividendSwitcher()` + `createDividend()` thật (#52) |
| `HoldingSwitcher` | Nhúng trong `DividendForm` | Sample options cứng trong `page.tsx`, luôn hiện |
| `DividendHistoryScreen` / `DividendHistoryList` | `/holdings/[id]/dividends` (mới) | `page.tsx` hardcode sample rows theo `id` — chờ `getDividendHistory(holdingId)` thật |
| Nút "Ghi cổ tức" + "Lịch sử cổ tức" | Mở rộng `HoldingDetailScreen` (`/holdings/[id]`, route đã wiring thật) | `Link` tĩnh, luôn hiện — không phụ thuộc dữ liệu Container |
| `DashboardQuickMenu` (FAB, mockup 4f) | `DashboardScreen` (`/`, route đã wiring thật) | "Mua / Bán" mở `TransactionHoldingPicker` (issue #54, xem mục 5 bên dưới — thay cho `Link` tĩnh cũ tới `ROUTES.holdings`); "Thêm vị thế"/"Cổ tức" vẫn `Link` tĩnh tới `newHolding`/`newDividendStandalone`; "Chốt số liệu hôm nay" phụ thuộc `snapshotToday` (ẩn khi Container chưa cấp) |
| `TransactionHoldingPicker` (mới, issue #54) | Sheet mở từ `DashboardQuickMenu` (`/`) | `page.tsx` truyền `getOpenHoldings()` thật (`tradeHoldings`) — wiring đầy đủ ngay từ đầu, không sample data |

---

## 1. Điểm lệch so với plan ban đầu (bám mockup thật)

Đây là phần **quan trọng nhất để verifier đối chiếu** — plan duyệt trước khi
xem mockup, các điểm sau lệch có chủ đích, không phải bỏ sót:

1. **Phạm vi lịch sử cổ tức: THEO TỪNG HOLDING, không phải toàn danh mục.**
   Plan quyết định (c) ban đầu giả định mirror `/snapshots` (portfolio-wide).
   Mockup 4e vẽ rõ: tiêu đề "Lịch sử cổ tức", phụ đề "FPT Corp · tiền mặt & cổ
   phiếu", 2 thẻ tổng hợp riêng cho FPT, không có mã nào khác xuất hiện trong
   danh sách. → Route đổi từ `/dividends` (portfolio-wide) thành
   `/holdings/[id]/dividends` (per-holding). Không có route `/dividends`
   (không có màn "lịch sử cổ tức toàn danh mục" trong scope Phase 4 Screens).

2. **`HoldingSwitcher` LUÔN hiện, không optional theo lối vào.** Plan ban đầu
   coi switcher là optional (`switcher?: HoldingSwitcherProps` — có mặt khi
   entry độc lập, vắng khi mở từ `HoldingDetailScreen`). Mockup chỉ vẽ MỘT
   biến thể màn 4a/4c, switcher luôn hiện bất kể lối vào (entry map ghi rõ:
   "Từ Chi tiết Holding → nút 'Ghi cổ tức', **hoặc** Dashboard → menu nhanh
   '+ Cổ tức'" cùng dẫn tới một màn 4a). → `DividendFormProps.switcher` đổi
   thành bắt buộc (không còn dấu `?`).

3. **CTA "Ghi cổ tức" KHÔNG nằm trong `DividendHistoryScreen`.** Plan quyết
   định (b) đặt CTA bên trong màn lịch sử (mirror `SnapshotFreezeSheet` nằm
   trong `SnapshotHistoryScreen` ở Phase 3). Mockup 4e chỉ có nút back +
   tiêu đề + phụ đề — không có nút "+"/"Ghi cổ tức" nào trên màn lịch sử. Theo
   entry map, 4a chỉ mở từ `HoldingDetailScreen` hoặc Dashboard, KHÔNG mở từ
   màn lịch sử. → `DividendHistoryList` chỉ có CTA "Ghi cổ tức" trong
   **empty state** (lời mời hành động khi rỗng, theo
   `component-architecture.md`), không có CTA thường trực khi đã có dữ liệu.

4. **Dashboard: hành động "Cổ tức" trong FAB menu nhanh mở THẲNG form ghi cổ
   tức, không qua màn lịch sử.** Hệ quả của điểm 1+3: vì không có lịch sử
   toàn danh mục và CTA không nằm trong màn lịch sử, entry point trên
   Dashboard phải trỏ thẳng `/dividends/new` (khớp entry map mockup:
   "Dashboard → menu nhanh '+ Cổ tức' mở thẳng 4a"), không phải trỏ tới lịch
   sử trước như quyết định (b) cũ. (Cơ chế trigger là FAB đầy đủ theo mockup
   4f — xem điểm 5.)

5. **FAB menu nhanh Dashboard dựng ĐẦY ĐỦ theo đúng mockup 4f — đảo ngược
   quyết định đơn giản hoá trước đó.** Bản đầu (trước review PR #53) đơn
   giản hoá thành 1 pill "Cổ tức" cạnh pill "Lịch sử" (lý do: 3/4 hành động
   đã có entry point riêng nơi khác, dựng FAB trùng lặp vượt phạm vi issue
   #51). Sau khi chủ dự án review PR và yêu cầu bám đúng mockup ("mockup ưu
   tiên hơn scope issue"), quyết định bị đảo ngược: dựng đủ FAB 4 hành động
   như mockup 4f, không giữ pill song song. Component mới
   `DashboardQuickMenu` (`src/features/dashboard/components/DashboardQuickMenu/`):
   đóng = nút tròn 58px nền `accent`, icon `Plus`; mở = cột 4 hành động (chip
   label bên trái + icon tròn 46px bên phải, animate `slide-in-from-bottom-1`)
   chồng lên scrim (`bg-black/55 backdrop-blur-[1px]`, bấm ra ngoài đóng lại),
   nút tròn đổi icon thành `X`. State đóng/mở là `useState` tại chỗ (UI thuần
   tuý, không phải điều hướng dữ liệu khác nhau — khác rule bắt buộc `Link`
   của `HoldingSwitcher`/tab điều hướng).

   Mockup không tự nói rõ đích đến của 2/4 hành động — đây LÀ quyết định
   thiết kế thật cần ghi lại (không còn là "điểm lệch" vì FAB đã bám đúng
   mockup):
   - **"Mua / Bán"** → **[ĐÃ ĐẢO NGƯỢC bởi issue #54]** ban đầu trỏ
     `ROUTES.holdings` (danh sách vị thế) với lý do "không có route thêm giao
     dịch không cần chọn Holding trước, trỏ tới danh sách để user tự chọn mã
     rồi bấm 'Thêm giao dịch' từ `HoldingDetailScreen` là lựa chọn ít giả định
     nhất". Quyết định này bị đảo ngược: đi qua `/holdings` rồi phải bấm tiếp
     vào 1 Holding rồi mới thấy nút "Thêm giao dịch" là quá nhiều bước cho một
     hành động tần suất cao (mua/bán) — user phải rời hẳn Dashboard, không
     quay lại được nhanh. Issue #54 dựng `TransactionHoldingPicker` (Sheet
     chọn mã ngay tại chỗ, mirror pattern `HoldingSwitcher` — xem mục 2b mới
     bên dưới): bấm "Mua / Bán" → đóng FAB, mở Sheet liệt kê `tradeHoldings`
     (Container đã cấp qua `getOpenHoldings()`) → chọn mã → `Link` thẳng
     `ROUTES.newTransaction(holdingId)`, không qua `/holdings` nữa.
   - **"Chốt số liệu hôm nay"** → không điều hướng route; đóng menu rồi cuộn
     mượt (`scrollIntoView({behavior:"smooth", block:"center"})`) tới
     `SnapshotTodayCard` đã render sẵn trên Dashboard. Thêm prop `id?: string`
     (mới, backward-compatible) cho `SnapshotTodayCard` để làm target
     (`id="snapshot-today-card"`, gán ở `DashboardScreen.tsx`). Khi Container
     chưa cấp `snapshotToday` (card không tồn tại trong DOM), `DashboardScreen`
     truyền `showSnapshotAction={false}` xuống — ẩn hẳn mục này khỏi FAB thay
     vì hiện một nút bấm không làm gì (an toàn hơn, đơn giản hơn).
   - "Thêm vị thế" → `ROUTES.newHolding`, "Cổ tức" → `ROUTES.newDividendStandalone`
     — cả hai route đã có sẵn, rõ ràng, không cần suy đoán thêm.

   Props contract (cập nhật bởi issue #54 — thêm `tradeHoldings`/`hidden` để
   forward xuống `TransactionHoldingPicker`, xem mục 2b):
   ```ts
   // DashboardQuickMenu.tsx
   type DashboardQuickMenuProps = {
     // false khi Container chưa cấp snapshotToday — ẩn hành động "Chốt số
     // liệu hôm nay" khỏi menu (không có SnapshotTodayCard để cuộn tới).
     showSnapshotAction: boolean;
     // Holding đang mở (quantity > 0), forward xuống TransactionHoldingPicker.
     tradeHoldings: HoldingSummary[];
     hidden?: boolean;
   };
   ```

   Lệch nhỏ so với mockup (có chủ đích): scrim (`z-40`) đặt CAO HƠN
   `BottomNav` (`z-20`) để che luôn thanh điều hướng đáy khi menu mở, thay vì
   theo đúng thứ tự z-index trong markup mockup (scrim `z-index:8` thấp hơn
   bottom nav `z-index:10`, khiến bottom nav không bị dim — nhiều khả năng là
   tác dụng phụ của thứ tự DOM trong công cụ thiết kế hơn là chủ đích UX).
   Che luôn `BottomNav` khi menu mở an toàn hơn (tránh bấm nhầm tab khác khi
   đang mở FAB).

   Đã xoá hẳn pill "Cổ tức" đơn giản hoá cũ khỏi `DashboardScreen.tsx` — chỉ
   còn FAB, không giữ song song 2 cơ chế trigger.

6. **Bỏ nút "Xem lịch sử cổ tức" mockup 4b filter/badge "sắp chia" (upcoming
   dividend).** Dòng HPG trong sheet chọn mã (4b) có badge "sắp chia" — không
   có field domain nào (Dividend/Holding) biểu diễn "cổ tức sắp công bố"; đây
   là dữ liệu không có thật trong scope hiện tại (không phải lịch công bố cổ
   tức tự động). Bỏ badge này, không tạo field giả.

7. **Bỏ số liệu XIRR "trước → sau" giả định trong preview (4a) và bớt 1 dòng
   ở màn "Đã ghi" (4d).** Mockup 4a hiện chip "XIRR ước tính 17,4% → 17,9%",
   4d hiện dòng tương tự + dòng "Snapshot MANUAL đã chốt tự động". Tính XIRR
   trước/sau đòi hỏi chạy lại toàn bộ chuỗi dòng tiền danh mục (domain logic,
   `lib/xirr.ts` — cấm design-implementer đụng vào) nên **không thể tính thật
   ở client**; bịa số cố định sẽ sai lệch với dữ liệu thật của user.
   - Preview (4a): giữ chip minh hoạ nhưng bỏ số phần trăm cụ thể, chỉ còn
     câu chữ định tính ("Net ... ghi làm dòng tiền dương trong chuỗi XIRR —
     số minh hoạ, Server Action sẽ tính lại").
   - Màn "Đã ghi" (`DividendRecordedResult`): trường `xirrBeforePercent`/
     `xirrAfterPercent` **optional** — Server Action (#52) có dữ liệu thật thì
     truyền vào, component tự ẩn khối "Ảnh hưởng lên hiệu suất" nếu vắng.
   - Bỏ hẳn dòng "Snapshot MANUAL đã chốt tự động" — việc ghi cổ tức có tự
     động tạo snapshot hay không là quyết định nghiệp vụ (Phase 3) chưa được
     xác nhận trong scope Phase 4, không tự suy đoán.

8. **Trạng thái "Đã ghi cổ tức" (4d) render INLINE trong `DividendForm`, không
   phải route/redirect riêng.** Plan quyết định (d) để ngỏ "có điều hướng sau
   khi ghi hay không" cho #52 (mirror `NavOverrideForm` chưa quyết định). Thay
   vì để ngỏ, áp dụng đúng pattern đã có tiền lệ trong repo
   (`SnapshotFreezeSheet.isDone`, `SnapshotTodayCard`): khi
   `state?.ok === true`, component tự chuyển sang hiển thị nội dung 4d ngay
   tại chỗ (cùng `PageHeader`, ẩn form). Không cần route mới, không cần
   `router.push`, không cần business-implementer quyết định thêm.

9. **Thêm entry "Lịch sử cổ tức" ở `HoldingDetailScreen`** (icon-only, cạnh
   nút "Ghi cổ tức") — plan duyệt chỉ nói thêm nút "Ghi cổ tức" cạnh "Thêm
   giao dịch", không nhắc "Lịch sử cổ tức". Mockup entry map ghi rõ: "Từ Chi
   tiết Holding → 'Lịch sử cổ tức'" là một lối vào thật của 4e — bổ sung để
   không thiếu lối vào duy nhất tới màn lịch sử (Dashboard không có lối vào
   lịch sử theo điểm 4).

10. **Bỏ trường `note` khỏi form.** Plan liệt kê field submit gồm
    `date, percent, note?`. Mockup 4a/4c không có ô nhập ghi chú nào (khác
    `TransactionForm` có "Ghi chú (tuỳ chọn)"). `Dividend.note` vẫn tồn tại
    trong schema (String?) — Server Action #52 có thể để trống hoặc
    business-implementer tự quyết định thêm ô này sau nếu cần, design-
    implementer không tự thêm UI không có trong mockup.

11. **Percent input là ô nhập số thường (`<Input>`), không phải slider kéo.**
    Mockup vẽ một thanh dọc màu accent cạnh số % (gợi ý con trỏ/kéo) nhưng
    không vẽ track slider thật — kho component chưa có atom slider, và nhập
    tay chính xác hơn kéo cho số liệu tài chính. Giữ input số, bỏ chi tiết
    trang trí thanh dọc.

---

## 2. HoldingSwitcher (mới)

- File: `src/features/dividends/components/HoldingSwitcher/{HoldingSwitcher.tsx,index.ts}`
- Client component (`"use client"`, cần `Sheet` + state tìm kiếm). Trigger =
  pill switcher (mockup 4a/4c), mở `Sheet` liệt kê Holding đang mở (4b).
- Ô "Tìm mã…" trong sheet **có hoạt động thật** (lọc client-side mảng
  `options` đã có sẵn từ props — không fetch gì thêm, không vi phạm rule "tab
  đổi dữ liệu phải tách route" vì đây là lọc HIỂN THỊ trên cùng 1 tập dữ liệu
  nhỏ đã tải).
- Đổi mã = `<Link>` thật sang `ROUTES.newDividend(id)` (điều hướng route mới,
  không giữ state), đúng rule tab điều hướng.
- Avatar (trigger + từng dòng) tô **accent** cố định (`bg-accent/14
  text-accent`), khác `SymbolAvatar` mặc định hash-theo-mã dùng ở nơi khác
  trong app — quyết định thị giác riêng cho ngữ cảnh "đang chọn mã để ghi cổ
  tức" (khớp mockup, mọi dòng trong 4a/4b đều tô cùng 1 màu accent, không
  hash-theo-mã).

```ts
// src/features/dividends/types.ts
export type DividendHolding = {
  id: string;
  symbol: string;
  name: string | null;
  type: AssetType;
  quantity: string;
  unit: string;
  avgCost: string; // hiển thị ở switcher trigger — "giá vốn {avgCost}"
  marketValue: string; // hiển thị ở dòng trong sheet — "{quantity} · {marketValue}"
};

// HoldingSwitcher.tsx
type HoldingSwitcherOption = DividendHolding & {
  href: string; // ROUTES.newDividend(id)
  isCurrent: boolean;
};
type HoldingSwitcherProps = {
  current: DividendHolding;
  options: HoldingSwitcherOption[]; // CHỈ Holding đang mở (quantity > 0), luôn gồm current
  hidden?: boolean;
};
```

## 2b. TransactionHoldingPicker (mới, issue #54)

- File: `src/features/holdings/components/TransactionHoldingPicker/{TransactionHoldingPicker.tsx,index.ts}`.
- Client component (`"use client"`, cần `Sheet` + state tìm kiếm). KHÔNG có
  `SheetTrigger` bên trong — trigger là nút "Mua / Bán" của
  `DashboardQuickMenu` (FAB), đóng/mở điều khiển hoàn toàn bằng state ngoài
  (`open`/`onOpenChange` truyền qua props, controlled `Dialog.Root`). Khác
  `HoldingSwitcher`: ở đó trigger là pill switcher persistent bên trong form,
  luôn có một `current` holding "đang chọn"; ở đây chưa có holding nào đang
  chọn trước, và chọn xong thì `Link` điều hướng đi luôn (không ở lại Sheet).
- Ô "Tìm mã…" lọc client-side, copy nguyên pattern `HoldingSwitcher` (lọc
  theo `symbol`/`name` trên mảng `holdings` đã có sẵn từ props).
- Chọn mã = `<Link>` thật sang `ROUTES.newTransaction(holding.id)`.
- Avatar dùng `SymbolAvatar` mặc định (hash-theo-mã), KHÔNG tô accent cố định
  như `HoldingSwitcher` — ngữ cảnh khác (không phải "đang chọn mã để ghi cổ
  tức" mà là danh sách vị thế trung tính, giống `HoldingsList`).
- Empty state khi `holdings.length === 0` ("Chưa có vị thế nào đang mở" + CTA
  `Link` tới `newHoldingHref`), khác `filtered.length === 0` (đã gõ tìm nhưng
  không khớp — "Không tìm thấy mã phù hợp.").

```ts
// TransactionHoldingPicker.tsx
type TransactionHoldingPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Holding đang mở (quantity > 0) — Container đã lọc sẵn (getOpenHoldings()),
  // không lọc lại trong component.
  holdings: HoldingSummary[];
  newHoldingHref: string; // ROUTES.newHolding — CTA khi holdings rỗng
  hidden?: boolean;
};
```

## 3. DividendForm (mới)

- File: `src/features/dividends/components/DividendForm/{DividendForm.tsx,index.ts}`
- Client component (`"use client"`), `useActionState` — cùng pattern
  `NavOverrideForm`. Một component dùng chung cho CASH (4a) và STOCK (4c),
  khác nhánh hiển thị theo `SegmentedControl` (`type`); trạng thái thành công
  (4d) render inline (xem điểm lệch 8).
- Preview client-side bằng `decimal.js` (giống `NavOverrideForm`) — CASH: gộp
  = `faceValuePerShare × percent/100 × quantity`, thuế = `gộp × taxRatePercent/100`,
  net = `gộp − thuế`. STOCK: tăng thêm = `quantity × percent/100`, sau khi
  ghi = `quantity + tăng thêm`. Preview chỉ minh hoạ — Server Action (#52) tự
  tính lại độc lập, không tin số client.
- Field submit thật: `holdingId` (hidden), `type` (hidden), `date`, `percent`
  — KHÔNG có `note` (điểm lệch 10), KHÔNG submit gross/tax/net/stockQuantity
  (server tự tính).
- Nhãn % đổi theo loại: CASH → "Tỷ lệ cổ tức (% mệnh giá)"; STOCK → "Tỷ lệ cổ
  tức cổ phiếu (%)".
- Nút submit: CASH tô `gain` (tiền vào), STOCK tô `accent` (không phát sinh
  tiền, khác ngữ nghĩa gain/loss) — không dùng nguyên màu "accent theme" tuỳ
  biến của mockup (chỉ là theme picker của công cụ thiết kế), map về đúng
  token ngữ nghĩa thật của app.

```ts
// DividendForm.tsx
type DividendFormProps = {
  holding: DividendHolding;
  switcher: HoldingSwitcherProps; // LUÔN có mặt (điểm lệch 2)
  faceValuePerShare: string; // sample "10000" — #52 đọc Setting mệnh giá thật
  taxRatePercent: string; // sample "5" — #52 đọc resolveSetting("DIVIDEND_TAX_RATE", ngày chia)
  defaultDateInputValue: string; // yyyy-MM-dd, mặc định hôm nay
  historyHref: string; // ROUTES.dividendHistory(holding.id) — icon history góc phải header
  closeHref: string;
  hidden?: boolean;
  action: (
    prevState: DividendFormState,
    formData: FormData,
  ) => Promise<DividendFormState>;
};
```

```ts
// src/features/dividends/types.ts
export type DividendFormState =
  | { ok: true; result: DividendRecordedResult }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

export type DividendRecordedResult = {
  symbol: string;
  type: "CASH" | "STOCK";
  percentLabel: string;
  dateLabel: string; // dd/MM/yyyy
  // CASH
  grossAmount?: string;
  taxAmount?: string;
  netAmount?: string;
  // STOCK
  addedQuantity?: string;
  afterQuantity?: string;
  unit?: string;
  // Optional — vắng mặt = ẩn khối "Ảnh hưởng lên hiệu suất" (điểm lệch 7)
  xirrBeforePercent?: string;
  xirrAfterPercent?: string;
  totalDividendReceived?: string;
  historyHref: string;
  holdingHref: string;
};
```

## 4. DividendHistoryList + DividendHistoryScreen (mới, per-holding)

- File:
  `src/features/dividends/components/DividendHistoryList/{DividendHistoryList.tsx,DividendRowsFilter.tsx,index.ts}`,
  `src/features/dividends/components/DividendHistoryScreen/{DividendHistoryScreen.tsx,index.ts}`
- `DividendHistoryList` là **Server Component** (mirror `SnapshotHistoryList`)
  — render 2 thẻ tổng hợp (tiền mặt/net, cổ phiếu thưởng) tĩnh + delegate danh
  sách cho `DividendRowsFilter` (client leaf, đẩy ranh giới client xuống lá).
- `DividendRowsFilter` (`"use client"`, KHÔNG export qua `index.ts` — cùng
  quy ước `MoneyValueToggleButton` không export) — 3 chip lọc Tất cả/Tiền
  mặt/Cổ phiếu **có hoạt động thật** (lọc mảng `rows` đã có sẵn từ props,
  cùng lý do như ô tìm kiếm switcher — không fetch route mới).
- `DividendHistoryScreen` = `PageHeader` (subtitle "{tên/mã} · tiền mặt & cổ
  phiếu") + `DividendHistoryList`. **Không có CTA "Ghi cổ tức" thường trực**
  (điểm lệch 3) — chỉ có trong action của `EmptyState` khi rỗng.

```ts
type DividendHistoryRow = {
  id: string;
  type: "CASH" | "STOCK"; // raw enum, label suy trong DividendRowsFilter (tiền lệ Snapshot badge)
  percentLabel: string; // "20"
  date: string; // dd/MM/yyyy đã format
  isNew?: boolean; // badge "MỚI"
  unit?: string; // STOCK bắt buộc để format quantity
  // CASH
  grossAmount?: string;
  taxAmount?: string;
  netAmount?: string;
  // STOCK
  quantityBefore?: string;
  quantityAfter?: string;
  addedQuantity?: string;
  note?: string; // Dividend.note tồn tại trong schema — giữ chỗ hiển thị dù mockup không vẽ
};

type DividendHistorySummary = {
  cashNetTotal: string;
  cashCount: number;
  stockAddedQuantityTotal: string;
  stockCount: number;
  unit: string;
};

type DividendHistoryListProps = {
  summary: DividendHistorySummary;
  rows: DividendHistoryRow[];
  hidden?: boolean; // ẩn netAmount/grossAmount/taxAmount (tiền), GIỮ percent/quantity
  newDividendHref: string; // chỉ dùng trong action của EmptyState
};

type DividendHistoryScreenProps = {
  backHref: string;
  holding: { symbol: string; name: string | null };
  summary: DividendHistorySummary;
  rows: DividendHistoryRow[];
  newDividendHref: string;
  hidden?: boolean;
};
```

## 5. Routes mới (`src/lib/routes.ts`)

```ts
newDividend: (holdingId: string) => `/holdings/${holdingId}/dividends/new`,
newDividendStandalone: "/dividends/new",
dividendHistory: (holdingId: string) => `/holdings/${holdingId}/dividends`,
```

Không có route `/dividends` (portfolio-wide) — xem điểm lệch 1.
`ROUTES.newDividend` dùng cho CẢ nút "Ghi cổ tức" ở `HoldingDetailScreen` LẪN
mọi dòng trong `HoldingSwitcher` (đổi mã), vì `DividendForm` luôn hiện
switcher (điểm lệch 2) nên không cần route/param riêng cho 2 lối vào.

## 6. Route mới (sample data, comment `// TODO(business-implementer, issue #52)`)

- `src/app/(dashboard)/holdings/[id]/dividends/new/page.tsx` — entry từ
  `HoldingDetailScreen`; `params.id` chọn holding hiện tại trong 5 mẫu
  (FPT/HPG/VNM/MWG/ACB), `notFound()` nếu không khớp.
- `src/app/(dashboard)/dividends/new/page.tsx` — entry độc lập từ Dashboard;
  mặc định chọn phần tử đầu (FPT) trong mẫu, không đọc query param (đổi mã
  qua switcher điều hướng sang route path-param ở trên, không cần
  `?holdingId=`).
- `src/app/(dashboard)/holdings/[id]/dividends/page.tsx` — lịch sử cổ tức
  theo `id`, 5 dòng mẫu (3 CASH + 2 STOCK) khớp mockup 4e.
- Cả 3 page đều **sync** (không `await`) → không cần `loading.tsx` (checklist
  rule 1, `component-architecture.md`).
- Server Action mẫu (`recordDividendSample`) khai `"use server"` inline ngay
  trong `page.tsx` (Server Component) — cùng tiền lệ
  `src/app/(dashboard)/settings/page.tsx` (`onSignOut`), không phải Server
  Action thật, chỉ trả `DividendFormState` giả để tự kiểm hiển thị 4 nhánh
  (CASH/STOCK × idle/done/error chưa cần vì lỗi để `state.ok=false` test thủ
  công riêng, không hardcode trong sample).

## 7. Sửa file có sẵn

- **`src/components/PageHeader/PageHeader.tsx`** — thêm prop optional
  `subtitle?: React.ReactNode` (dòng phụ dưới tiêu đề, backward-compatible —
  không đổi call site cũ nào). Dùng bởi `DividendForm`
  ("Nhập % → tự tính tiền nhận về" / "Cổ phiếu → tăng số lượng nắm giữ") và
  `DividendHistoryScreen` ("{tên} · tiền mặt & cổ phiếu").
- **`src/features/holdings/components/HoldingDetailScreen/HoldingDetailScreen.tsx`**
  (khối nút quanh "Lịch sử giao dịch"/"Thêm giao dịch") — thêm 2 phần tử:
  icon-only Link "Lịch sử cổ tức" (`History`, điểm lệch 9) + Link "Ghi cổ
  tức" (`Coins`, đúng plan) cạnh "Thêm giao dịch" đã có, bọc 3 nút trong 1
  nhóm `gap-1.5`. Luôn hiện tĩnh, không cần prop mới.
- **`src/features/dashboard/components/DashboardScreen/DashboardScreen.tsx`**
  — xoá pill "Cổ tức" đơn giản hoá trước đó, thay bằng
  `<DashboardQuickMenu showSnapshotAction={Boolean(snapshotToday)} />` (FAB
  đầy đủ theo mockup 4f, điểm lệch 5 đã đảo ngược), gán `id="snapshot-today-card"`
  cho `SnapshotTodayCard`. Không sửa `DashboardScreenSkeleton.tsx` — FAB là
  `fixed`, không thuộc flow layout trong skeleton, cùng tiền lệ `BottomNav`
  (cũng không xuất hiện trong skeleton).
- **`src/features/dashboard/components/SnapshotTodayCard/SnapshotTodayCard.tsx`**
  — thêm prop optional `id?: string` (backward-compatible), gán vào root
  `div` — làm target `scrollIntoView` cho `DashboardQuickMenu`.
- **`docs/rules/ui-ux-design.md`** — thêm 9 dòng icon mapping mới (`payments`
  → `Coins`, `library_add` → `Layers`, `calculate` → `Calculator`,
  `unfold_more` → `ChevronsUpDown`, `event` → `Calendar`, `search` → `Search`,
  `check` → `Check`, `check_circle` → `CheckCircle2`, `function` → `Sigma`)
  và mô tả prop `subtitle` mới của `PageHeader` trong bảng molecule.

---

## Query/Server Action business-implementer cần tạo (issue #52)

- `createDividend(input): ActionResult<Dividend>` — nhận
  `{ holdingId, type, date, percent, note? }`. Tự resolve
  `resolveSetting("DIVIDEND_TAX_RATE", date)` + Setting mệnh giá (chưa xác
  định tên key — cần #52 chốt, xem `docs/domain/README.md`); tự tính
  `grossAmount/taxAmount/netAmount` (CASH) hoặc `stockQuantity` (STOCK); khi
  STOCK, cộng `stockQuantity` vào `Holding.quantity` (transaction, tương tự
  cách `addTransaction` cập nhật `Holding.quantity`/`avgCost`). Trả về đủ dữ
  liệu để dựng `DividendRecordedResult` (bao gồm optional `xirrBeforePercent`/
  `xirrAfterPercent`/`totalDividendReceived` nếu tính được).
- `getOpenHoldingsForDividendSwitcher(): DividendHolding[]` — chỉ Holding
  `quantity > 0` của user hiện tại, kèm `avgCost`/`marketValue` (cần định giá
  hiện tại — dùng lại `valuateHoldings()` đã có ở Phase 2, xem
  `lib/valuation.ts`).
- `getDividendHistory(holdingId): { summary: DividendHistorySummary; rows: DividendHistoryRow[] }`
  — verify `holdingId` thuộc đúng user (không tin thẳng route param, cùng
  pattern `getHoldingDetail`).
- **Cần #52 xác nhận riêng:** tên Setting key cho "mệnh giá cổ tức" (mockup
  cố định 10.000₫/CP — có thể là hằng số domain thay vì Setting cấu hình
  được, khác `DIVIDEND_TAX_RATE` vốn đã có sẵn từ Phase 1). Ghi rõ quyết định
  này vào `process/DECISION.md` khi #52 chốt.
- **Cần #52 quyết định:** cổ tức cổ phiếu (STOCK) có làm thay đổi `avgCost`
  của Holding hay không (mockup 4c ghi chú "Giá vốn/CP giảm tương ứng vì
  tổng vốn chia cho nhiều CP hơn" — đúng về nguyên tắc kế toán, cần xác nhận
  công thức chính xác trước khi cập nhật `Holding.avgCost`).

---

## File đã tạo/sửa — tổng hợp

**Tạo mới:**
- `src/features/dividends/types.ts`
- `src/features/dividends/components/HoldingSwitcher/{HoldingSwitcher.tsx,index.ts}`
- `src/features/dividends/components/DividendForm/{DividendForm.tsx,index.ts}`
- `src/features/dividends/components/DividendHistoryList/{DividendHistoryList.tsx,DividendRowsFilter.tsx,index.ts}`
- `src/features/dividends/components/DividendHistoryScreen/{DividendHistoryScreen.tsx,index.ts}`
- `src/features/dashboard/components/DashboardQuickMenu/{DashboardQuickMenu.tsx,index.ts}`
  (mới, sau review PR #53 — thay pill "Cổ tức" đơn giản hoá bằng FAB đầy đủ
  theo mockup 4f, xem điểm lệch 5)
- `src/app/(dashboard)/holdings/[id]/dividends/new/page.tsx`
- `src/app/(dashboard)/dividends/new/page.tsx`
- `src/app/(dashboard)/holdings/[id]/dividends/page.tsx`
- `process/UI_phase_4.md` (file này)
- `.claude/design-cache/raw/Phase-4-Screens.dc.html` (cache, gitignore)
- `src/features/holdings/components/TransactionHoldingPicker/{TransactionHoldingPicker.tsx,index.ts}`
  (issue #54, sau khi phần trên đã merge — xem mục 2b và điểm lệch 5)

**Sửa (issue #54):**
- `src/features/dashboard/components/DashboardQuickMenu/DashboardQuickMenu.tsx`
  — action "trade" đổi từ `href: ROUTES.holdings` sang `onClick` mở
  `TransactionHoldingPicker`; thêm props `tradeHoldings`/`hidden`.
- `src/features/dashboard/components/DashboardScreen/DashboardScreen.tsx` —
  thêm prop `tradeHoldings: HoldingSummary[]`, forward xuống
  `DashboardQuickMenu` cùng `hidden`.
- `src/app/(dashboard)/page.tsx` — do `business-implementer` wiring
  `getOpenHoldings()` (không thuộc phạm vi `design-implementer`).

**Sửa (Phase 4 gốc):**
- `src/lib/routes.ts` — thêm `newDividend`, `newDividendStandalone`,
  `dividendHistory`.
- `src/components/PageHeader/PageHeader.tsx` — thêm prop optional `subtitle`.
- `src/features/holdings/components/HoldingDetailScreen/HoldingDetailScreen.tsx`
  — thêm Link "Lịch sử cổ tức" (icon-only) + "Ghi cổ tức".
- `src/features/dashboard/components/DashboardScreen/DashboardScreen.tsx` —
  xoá pill "Cổ tức" đơn giản hoá, thay bằng `DashboardQuickMenu` (FAB đầy đủ,
  sau review PR #53 — xem điểm lệch 5).
- `src/features/dashboard/components/SnapshotTodayCard/SnapshotTodayCard.tsx`
  — thêm prop optional `id` (target cuộn từ `DashboardQuickMenu`).
- `docs/rules/ui-ux-design.md` — icon mapping mới (gồm `swap_vert`→
  `ArrowLeftRight`, `add_chart`→`ChartNoAxesCombined` bổ sung sau review PR
  #53) + mô tả prop `subtitle` của `PageHeader`.
- `.claude/design-cache/index.json` — thêm entry `src/features/dividends`.

**Không sửa (đúng chỉ thị):**
- `prisma/schema.prisma`, mọi migration.
- `queries.ts`, mọi Server Action thật, `lib/xirr.ts`.
- `src/app/(dashboard)/page.tsx`, `holdings/[id]/page.tsx` — không cần đổi,
  các Link mới trỏ tới route mới độc lập.
- `DashboardScreenSkeleton.tsx` — không cần đổi (xem mục 7, lý do hình dạng
  không đổi).
- Không tạo `DividendDetailScreen` (drill-down 1 dòng lịch sử) — ngoài scope.
- Không viết test render/snapshot cho component Presentational mới (tiền lệ
  Phase 3, `docs/rules/testing.md`).

## Kết quả kiểm tra

- `tsc --noEmit` (qua `node ./node_modules/typescript/bin/tsc`, `pnpm`
  không chạy được trong môi trường agent này do yêu cầu Node ≥22.13 chưa cài
  — chạy thẳng `tsc`/`eslint`/`vitest`/`prettier` từ `node_modules/.bin`
  tương đương) — pass, không lỗi.
- `eslint` trên toàn bộ file đã tạo/sửa — pass, không cảnh báo.
- `vitest run` (toàn bộ suite có sẵn) — 14 file / 158 test pass, không có
  test nào vỡ.
- `prettier --write` — đã format toàn bộ file tạo/sửa (không đụng file ngoài
  phạm vi).
- Theo `docs/rules/testing.md`: không viết test render/snapshot cho component
  Presentational mới (`HoldingSwitcher`, `DividendForm`, `DividendHistoryList`,
  `DividendRowsFilter`, `DividendHistoryScreen`).
- **Không** tự chạy `pnpm e2e` (Playwright) — theo ranh giới vai trò
  `design-implementer`, việc verify toàn diện (bao gồm e2e suite) thuộc về
  agent `verifier` ở bước sau.
