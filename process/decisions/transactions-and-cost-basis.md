# Quyết định — Giao dịch & giá vốn

Phạm vi: mua/bán, `Cashflow`, giá vốn bình quân (`avgCost`), `derivePosition()`, materialized cache `Holding.quantity`/`avgCost`.
Spec tương ứng: [`docs/domain/02-transactions-and-cost-basis.md`](../../docs/domain/02-transactions-and-cost-basis.md), [`docs/domain/01-assets-and-holdings.md`](../../docs/domain/01-assets-and-holdings.md).

> Đọc file này khi đụng `lib/cost-basis.ts`, `lib/position-trail.ts`, 4 Server Action mua/bán (`features/holdings/actions.ts`), hoặc cache vị thế.

---

## 2026-07-11 — Materialize `Holding.quantity`/`avgCost` (issue #18)

**Status:** Accepted

**Materialize `Holding.quantity`/`avgCost` — issue #18 (O(number) thay O(cashflow)).**
- Thêm 2 cột cache (`quantity`, `avgCost`); overview đọc thuần 2 cột. **Bất biến:** nguồn sự thật `Cashflow`, ghi cache bằng `derivePosition()` trong **cùng transaction** mọi mutation ⚠️ **Phase 4 dividend cũng đổi `quantity`** → phải cập nhật cache theo bất biến.
- Route tách `/holdings` ↔ `/holdings/closed` qua route group. Backfill đã áp.
- Docs: `docs/rules/data-prisma.md` (mục "Materialized cache").

---

## 2026-07-16 (4) — Issue #59: vị thế phải tính cả cổ tức cổ phiếu

**Status:** Superseded một phần bởi [2026-07-24 (4)](#2026-07-24-4--sửa-lần-3--4-pr-87-gộp-về-một-derivePosition-duy-nhất) (hàm `derivePosition()` cũ đã bị xoá, hàm mới chiếm lại tên đó)

**Issue #59: `derivePosition()` cũ (chỉ-Cashflow, đã xoá — xem 2026-07-24 (4)) một mình không đủ khi Holding từng nhận cổ tức cổ phiếu — thêm hàm mới xử lý cả cổ tức cổ phiếu (`derivePositionIncludingStockDividends()`, sau đổi tên thành `derivePosition()` ở 2026-07-24 (4)), dùng ở 4 action mua/bán + `getHoldingDetail()`.**
- Bối cảnh: viết e2e cho issue #52 phát hiện trang chi tiết vị thế hiện sai SL sau khi nhận cổ tức cổ phiếu. Đào sâu hơn phát hiện phạm vi rộng hơn ban đầu tưởng: không chỉ `getHoldingDetail()` (display sai) mà cả 4 action ghi giao dịch (`createHolding`/`addTransaction`/`updateTransaction`/`deleteTransaction`, `features/holdings/actions.ts`) đều gọi `derivePosition()` cũ (chỉ biết `Cashflow`) rồi **ghi đè toàn bộ** cache `Holding.quantity`/`avgCost` qua `persistPosition()` — mỗi lần mua/bán/sửa/xoá SAU khi nhận cổ tức cổ phiếu sẽ **xoá mất** phần SL cổ tức đã cộng trước đó (không chỉ hiển thị sai, mà mất dữ liệu cache thật). Đồng thời `wentNegative` (cờ "bán vượt") cũng tính từ Cashflow-only, có thể **chặn nhầm một lệnh bán hợp lệ** khi SL bán nằm trong phần cổ tức cổ phiếu đã nhận (không phải mua).
- Quyết định: thêm `derivePositionIncludingStockDividends(cashflows, stockDividends)` (`lib/cost-basis.ts`) — kết hợp `avgCost` từ `derivePosition()` cũ (giữ nguyên không đổi, chỉ dẫn xuất từ `Cashflow`, cổ tức cổ phiếu không đổi avgCost) với SL/`wentNegative` phát lại đúng thứ tự thời gian gồm cả `Dividend{STOCK}` qua `buildQuantityTimeline()`. **`derivePosition()` cũ giữ nguyên không đổi** (vẫn đúng/đủ riêng cho `avgCost`, unit test cũ không cần sửa) — tránh rủi ro đổi hàm đã có test suite lớn bao phủ. (Về sau, ở 2026-07-24 (4), `derivePosition()` cũ bị xoá hẳn và `derivePositionIncludingStockDividends()` chiếm lại tên đó.)
- **Di chuyển `buildQuantityTimeline()`/`PositionTrailEvent` từ `features/dividends/position-trail.ts` ra `lib/position-trail.ts`** (`docs/rules/project-structure.md`: "chỉ đẩy lên `lib/` chung khi thực sự tái dùng ở nhiều feature") — giờ dùng chung cả `features/holdings/` (qua `cost-basis.ts`) lẫn `features/dividends/` (giữ nguyên 2 chỗ dùng cũ, chỉ đổi đường import).
- **Giao dịch ĐANG XỬ LÝ (chưa lưu DB) dùng `id: "__candidate__"` + `createdAt` = mốc xa nhất có thể** (`CANDIDATE_CREATED_AT`, cùng pattern `PROBE_CREATED_AT` của `dividends/actions.ts`) khi đưa vào `buildQuantityTimeline()` — đảm bảo LUÔN được coi là sự kiện gần nhất khi trùng ngày với cashflow/dividend đã ghi trước đó.
- **Đồng ý (chủ động, không tự chốt thay) chấp nhận giới hạn:** tie-break cùng ngày giữa Cashflow và Dividend dựa vào `createdAt` thật (độ chính xác cấp mili-giây) — không có ca biên thực tế nào trong app cần chính xác hơn (domain chỉ nói "ngày", không nói "giờ trong ngày").
- **Không viết migration backfill dữ liệu cũ** — app chưa có user thật ngoài dev/test (phi thương mại, mới ở Phase 4), không có Holding nào bị ảnh hưởng thật ngoài môi trường phát triển.
- **Bài học ghi vào `docs/rules/data-prisma.md`** (mục "Materialized cache…"): khi thêm một NGUỒN GHI MỚI cho giá trị đã materialize (ở đây: cổ tức cổ phiếu ghi thêm vào `Holding.quantity`), phải rà **toàn bộ nơi recompute/derive lại giá trị đó** — không chỉ nơi vừa thêm nguồn ghi mới, mà cả các nơi ghi/đọc CŨ đã tồn tại từ trước (4 action mua/bán, 1 query display) mà giờ đã lỗi thời vì không biết nguồn ghi mới.
- Docs đã sync: `docs/domain/01-assets-and-holdings.md` (mục "Cách tính"), `docs/domain/02-transactions-and-cost-basis.md` (mục "Quy tắc & bất biến" + "Cách tính"), `docs/domain/03-dividends.md` (sửa đường dẫn `position-trail.ts`), `docs/rules/data-prisma.md` (mục "Materialized cache…", thêm "Ca thật đã xảy ra").

---

## 2026-07-24 (2) — Code review PR #87: thiết kế "2 bộ đếm song song"

**Status:** Superseded bởi [2026-07-24 (3)](#2026-07-24-3--sửa-lần-2-pr-87-một-bộ-đếm-realquantity-duy-nhất) (điểm (a)) · điểm (b) — cờ `pnlSplitIsApproximate` — vẫn Accepted

**Code review PR #87 — 2 quyết định thiết kế cho fix `realizedPnl` khi có cổ tức cổ phiếu + cờ cảnh báo `pnlSplitIsApproximate`.**
- Bối cảnh: PR #87 (gộp issue #83 + #82 + #67) chưa merge, chạy code review đa góc nhìn tìm ra 9 finding. Nghiêm trọng nhất: `computeRealizedGainForHolding()` (`lib/realized-pnl.ts`) tính sai `realizedPnl` khi holding có cổ tức cổ phiếu — hàm chỉ phát lại `Cashflow` (BUY/SELL) trong khi cổ tức cổ phiếu cộng thẳng vào `Holding.quantity` mà không tạo `Cashflow` (`features/dividends/actions.ts`), đúng vấn đề issue #59 đã giải quyết ở write-path bằng `derivePosition()` (khi đó tên `derivePositionIncludingStockDividends()`).
- **(a) Quyết định thiết kế "2 bộ đếm song song" ở `computeRealizedGainForHolding` — `avgCostQuantity`/`avgCost` (CHỈ track BUY/SELL) tách riêng khỏi `realQuantity` (track CẢ BUY/SELL lẫn cổ tức cổ phiếu).** Lý do KHÔNG dùng `realQuantity` làm mẫu số cho công thức bình quân di động (averaging): sẽ pha loãng `avgCost` bởi cổ tức cổ phiếu, sai quy tắc domain đã chốt ("cổ tức cổ phiếu không đổi avgCost", `docs/domain/03-dividends.md`) và làm `avgCost` ở đây lệch khỏi `avgCost` cache thật trên `Holding` (chỉ derive từ `Cashflow`, mirror `derivePosition()`). `realQuantity` CHỈ dùng để quyết định đúng thời điểm reset `avgCost`/`avgCostQuantity` về 0 (khi vị thế THỰC SỰ đóng hết, kể cả phần số lượng đến từ cổ tức) — đổi điều kiện reset từ `avgCostQuantity.isZero()` sang `realQuantity.isZero()` là fix mấu chốt, không đổi 1 dòng công thức averaging nào khác. Verify bằng số tính tay trong `src/lib/realized-pnl.test.ts` (BUY 100 → cổ tức +20 → SELL 120 → BUY 50 → SELL 30, tổng `realizedGain` kỳ vọng 130.000; nếu không reset đúng sẽ ra avgCost lô mới 13.333,33 thay vì 12.000 đúng).
- **(b) Quyết định thêm cờ `pnlSplitIsApproximate` (thay vì sửa cơ chế cutoff-accuracy tổng thể).** Giới hạn "`unrealizedPnl` dùng `quantity`/`avgCost` HIỆN TẠI, không phải tại `cutoffDate`" đã chốt là chấp nhận được ở entry 2026-07-24 (b) (issue #67, xem [`returns-xirr-and-pnl.md`](./returns-xirr-and-pnl.md)) — chỉ thêm cờ `pnlSplitIsApproximate: boolean = (selection.key !== "TODAY")` vào `XirrAndPnlCore`/`PortfolioValuation` để UI cảnh báo khi mốc chốt khác hôm nay, KHÔNG mở rộng phạm vi sửa cutoff-accuracy trong lần này (vẫn ngoài phạm vi, cùng lý do đã ghi ở (b)).
- Đồng thời dọn 3 trùng lặp/lệch nhỏ tìm được cùng đợt review: tách `sortByPositionTrailOrder()` (`lib/position-trail.ts`) dùng chung giữa `buildQuantityTimeline()` và `computeRealizedGainForHolding()` (tiebreak `(date, createdAt, id)` nhất quán toàn repo); `getAllCashflowsForXirr()` thêm `orderBy`/`id`/`createdAt` cho đúng tiebreak khi group theo holding; tách `paginateWithCursor()` (`lib/snapshot-history.ts`) dùng chung cho `getSnapshotHistory()`/`getMoreSnapshotHistory()` (trước đó lặp lại y hệt khối peek `LIMIT+1`/tính `hasMore`/`nextCursor`), đồng thời bỏ field `hasMore` dư thừa khỏi kiểu trả về của `getSnapshotHistory()` (không consumer nào khác cần ngoài `nextCursor !== null`).
- Không sửa `derivePosition()` cũ / `CashflowInput` / `derivePositionIncludingStockDividends()` (`lib/cost-basis.ts`) hay 4 Server Action ghi giao dịch (`features/holdings/actions.ts`) — giữ nguyên quyết định 2026-07-24 (a) ở entry issue #67, chỉ sửa lớp đọc (`lib/realized-pnl.ts`).
- Không đổi Prisma schema — mọi field cần (`Cashflow.id/createdAt`, `Dividend.id/createdAt/stockQuantity`) đã tồn tại.
- Docs đã sync: `docs/domain/05-returns-xirr-and-pnl.md` (mục "Quy tắc & bất biến" — 2 gạch đầu dòng mới), `process/PROCESS.md` (nhật ký).
- Tham chiếu: code review PR #87.

---

## 2026-07-24 (3) — Sửa lần 2 PR #87: một bộ đếm `realQuantity` duy nhất

**Status:** Accepted (bổ sung thêm bởi [2026-07-24 (4)](#2026-07-24-4--sửa-lần-3--4-pr-87-gộp-về-một-derivePosition-duy-nhất) — reset tường minh khi đóng hết)

**Sửa lần 2 PR #87 — retrofit thiết kế "2 bộ đếm song song" thành "1 bộ đếm `realQuantity` duy nhất" cho CẢ `computeRealizedGainForHolding` (đã merge, sửa lại) LẪN `derivePositionIncludingStockDividends` (bug write-path chưa fix).**
- Bối cảnh: thiết kế "2 bộ đếm song song" chốt ở entry `2026-07-24 (2)` (a) chỉ đúng cho ca **đóng hết vị thế rồi mở lại** — điều kiện reset `avgCostQuantity`/`avgCost` (`realQuantity.isZero()`) không bao giờ kích hoạt ở ca **bán một phần (không đóng hết, kể cả tính CP từ cổ tức) rồi mua tiếp**, vì vị thế chưa từng thực sự chạm 0. `avgCostQuantity` (bộ đếm chỉ-Cashflow) khi đó đã lệch khỏi `realQuantity` (có tính cổ tức) mà không được xoá, bị dùng làm mẫu số/tử số bình quân sai ở lần BUY kế tiếp. Rà lại phát hiện `derivePositionIncludingStockDividends()` (`lib/cost-basis.ts`, write-path thật — cache `avgCost`/`totalCostBasis` trên `Holding`, dùng ở 4 Server Action ghi giao dịch + `getHoldingDetail`) mắc **cùng họ bug** nhưng CHƯA từng fix: hàm này lấy `avgCost` thẳng từ `derivePosition(cashflows)` cũ (chỉ-Cashflow, đã xoá — xem 2026-07-24 (4)) — chỉ biết BUY/SELL, không biết cổ tức cổ phiếu.
- **Quyết định: đổi cả hai hàm từ "2 bộ đếm + reset tường minh" sang "1 bộ đếm `realQuantity` duy nhất" (gồm cả BUY/SELL lẫn cổ tức cổ phiếu).** `avgCost` chỉ đổi ở BUY, dùng `realQuantity` NGAY TRƯỚC sự kiện đó (không phải biến cashflow-only riêng) làm cơ sở bình quân: `newAvgCost = (realQuantityTrước*avgCostCũ + tiềnMua) / (realQuantityTrước+SLMua)`. Khi vị thế đóng hết thật (`realQuantityTrước=0`), số hạng `0*avgCostCũ=0` tự "quên" avgCost cũ — không cần bước reset tường minh riêng, đúng cho CẢ ca đóng hết LẪN ca bán một phần. `derivePositionIncludingStockDividends()` áp dụng cùng công thức, tái dùng `before`/`after` sẵn có từ `buildQuantityTimeline()` (`lib/position-trail.ts`) làm `realQuantityTrước`/`SL sau BUY` — không thêm vòng lặp tính quantity riêng.
- Verify bằng số tính tay, ca biên "bán một phần rồi mua tiếp" (BUY 100 → cổ tức +20 → SELL 105, real còn 15 không về 0 → BUY 85 → SELL 100 đóng hết): `avgCost` sau BUY 85 = 171.500 (`src/lib/cost-basis.test.ts`), tổng `realizedGain` = 8.060.000 (`src/lib/realized-pnl.test.ts`, so với 4.022.500 sai theo thiết kế "2 bộ đếm" cũ). Test "đóng hết rồi mua lại" (130.000, `2026-07-24 (2)`) chạy lại vẫn đúng với thiết kế mới — không đổi số kỳ vọng, chỉ khác cách hiện thực bên trong.
- **Production chưa có record cổ tức cổ phiếu nào** (user xác nhận) → không cần script recompute/migration dữ liệu cũ, chỉ áp dụng cho giao dịch mới từ giờ trở đi.
- Không đổi chữ ký `derivePosition()` cũ, `derivePositionIncludingStockDividends()`, `computeRealizedGainForHolding()` — chỉ đổi cách tính bên trong. Không đổi 4 Server Action ghi giao dịch, `getHoldingDetail`, hay chỗ gọi `computeRealizedGainForHolding` ở `portfolio-valuation.ts`. Không đổi Prisma schema.
- Không xử lý ca lý thuyết "cổ tức xen giữa lúc `realQuantity=0` và BUY kế tiếp" (holding không giữ cổ phần nào mà vẫn nhận cổ tức) — trạng thái dữ liệu không hợp lệ theo domain, chỉ ghi chú comment trong code.
- Docs đã sync: `docs/domain/05-returns-xirr-and-pnl.md` (mục "Quy tắc & bất biến" — sửa lại mô tả cơ chế reset cho khớp thiết kế mới), `process/PROCESS.md` (nhật ký).
- Tham chiếu: PR #87 (sửa lần 2, tiếp theo entry `2026-07-24 (2)`).

---

## 2026-07-24 (4) — Sửa lần 3 + 4 PR #87: gộp về một `derivePosition()` duy nhất

**Status:** Accepted — đây là trạng thái HIỆN HÀNH của `derivePosition()`

**Sửa lần 3 PR #87 — xoá `derivePosition()` cũ (chỉ-Cashflow), đổi tên `derivePositionIncludingStockDividends()` thành `derivePosition()`, gộp toàn bộ test về một hàm duy nhất — phát hiện VÀ sửa lần 4: bug thật "avgCost không reset về 0 khi đóng hết vị thế bằng SELL không có BUY sau đó".**
- Bối cảnh: sau fix lần 2 (entry `2026-07-24 (3)`), `derivePositionIncludingStockDividends()` không còn gọi `derivePosition(cashflows)` cũ để lấy `avgCost` nữa → `derivePosition()` cũ không còn production caller nào, chỉ còn sống trong `cost-basis.test.ts`. Thảo luận với user phát hiện 2 vấn đề: (1) test suite của `derivePositionIncludingStockDividends()` thiếu case trực tiếp cho "mua có phí"/"số lượng thập phân" — trước đây được bảo vệ GIÁN TIẾP qua test của `derivePosition()` cũ (khi hàm mới còn delegate `avgCost` cho nó), sự bảo vệ gián tiếp đó đã đứt sau fix lần 2; (2) giữ `derivePosition()` cũ làm "oracle đối chiếu" không có giá trị thật — công thức `avgCost` trong `derivePositionIncludingStockDividends()` là COPY trực tiếp từ `derivePosition()` cũ (cùng người, cùng lúc viết), không phải 2 cách tính độc lập. Giữ 2 bản công thức song song (dù 1 bản chỉ còn sống trong test) chính là pattern đã gây ra chuỗi bug retrofit ở entry `2026-07-24 (2)` và `(3)`.
- **Quyết định (sửa lần 3): xoá hẳn `derivePosition()` cũ (hàm + test suite riêng), đổi tên `derivePositionIncludingStockDividends()` thành `derivePosition()`** (chiếm lại tên cũ — giờ là cài đặt DUY NHẤT, tên "IncludingStockDividends" không còn ý nghĩa "thêm vào một hàm gốc khác" nữa). Viết lại toàn bộ 10 test case của `derivePosition()` cũ để gọi hàm mới với `stockDividends=[]`, gộp vào đầu describe hiện có (trước các test có cổ tức) — đồng thời tự động lấp gap coverage (phí, số thập phân) lên đúng hàm sản xuất thật mà không cần viết test mới. Xoá test "không có cổ tức nào -> kết quả khớp `derivePosition()` thuần" (không còn gì để đối chiếu sau khi gộp).
- **Bug phát hiện khi gộp test (sửa lần 4):** test "bán đúng hết số lượng đang giữ -> quantity và avgCost về 0" FAIL trên hàm mới — `avgCost` trả về 100.000 thay vì 0. Nguyên nhân: cơ chế "tự quên `avgCost` cũ nhờ nhân `realQuantityTrước=0`" (chốt ở sửa lần 2) chỉ kích hoạt tại **lần BUY kế tiếp** (vì vòng lặp `avgCost` chỉ duyệt qua BUY) — nếu chuỗi sự kiện kết thúc ngay sau một lệnh SELL đóng hết vị thế (không còn BUY nào sau), không có "lần BUY kế tiếp" nào để kích hoạt việc quên, nên `avgCost` bị kẹt ở giá trị cũ dù `quantity` thật đã về 0. Đây là regression có thật đưa vào từ sửa lần 2 (2026-07-24 (3), đã có sẵn trong PR #87 trước khi bắt đầu việc rename/dedup này) — không phải lỗi do rename gây ra, chỉ bị phơi ra khi gộp test trực tiếp vào hàm sản xuất thật. Ảnh hưởng thật: `Holding.avgCost` (materialize) hiện sai (khác 0) cho một vị thế đã bán sạch không mua lại — hiển thị trong `HoldingSummary` (cả tab "Đã đóng"), dù `totalCostBasis` vẫn đúng (nhân với `quantity=0`).
- **Quyết định (sửa lần 4): thêm reset tường minh `if (quantity.isZero()) avgCost = new Decimal(0);` ngay trước `return`, dùng `quantity` thật (dividend-aware, đã tính đúng ở vòng lặp `buildQuantityTimeline()` phía trên) — không dùng một biến cashflow-only riêng.** Nhất quán với thiết kế "real quantity là nguồn sự thật duy nhất" xuyên suốt hàm này (cùng tinh thần sửa lần 2). Không cần sửa `computeRealizedGainForHolding()` (`lib/realized-pnl.ts`) — hàm đó không trả `avgCost` ra ngoài (chỉ dùng nội bộ để tính `realizedGain`), nên `avgCost` "kẹt" ở cuối hàm không ảnh hưởng giá trị trả về.
- 4 call site sản xuất thật (`features/holdings/actions.ts` — 4 Server Action, `features/holdings/queries.ts::getHoldingDetail`) đổi tên lời gọi, tham số truyền vào không đổi.
- Docs đã sync: `docs/domain/05-returns-xirr-and-pnl.md`, `docs/domain/01-assets-and-holdings.md`, `docs/domain/02-transactions-and-cost-basis.md`, `docs/rules/data-prisma.md`, `process/PROCESS.md` (nhật ký).
- Tham chiếu: PR #87 (sửa lần 3 + 4, tiếp theo entry `2026-07-24 (3)`).

---

## Quyết định liên quan ở file khác

- Thứ tự sự kiện cùng ngày (`rank`, `Dividend` trước `Cashflow{MATURITY}`) — [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md), mục 2026-07-28 (2) điểm (1).
- Phí mua gộp vào `avgCost` (đóng issue #66) — [`tax-and-fees.md`](./tax-and-fees.md), mục 2026-07-18 (4) điểm (3).
- Tách `realizedPnl`/`unrealizedPnl` (issue #67) — [`returns-xirr-and-pnl.md`](./returns-xirr-and-pnl.md), mục 2026-07-24.
