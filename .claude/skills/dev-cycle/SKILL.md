---
name: dev-cycle
description: Điều phối tự động vòng đời triển khai một task Navtrack — spawn agent planner → business-implementer/design-implementer → quality-verifier → e2e-verifier → verifier tuần tự, lặp lại implementer nếu gap, rồi tự commit → push → tạo PR qua issuer khi verifier xác nhận đạt. Có track rút gọn cho hotfix khi user yêu cầu rõ. Dùng khi user muốn giao hẳn một task/phase để tự chạy hết chu trình thay vì tự tay từng bước.
---

# Dev Cycle — điều phối planner → implementer → quality-verifier → e2e-verifier → verifier

Skill này điều phối các agent đã có trong dự án (`planner`, `business-implementer`/`design-implementer`, `quality-verifier`, `e2e-verifier`, `verifier`) chạy thành một vòng lặp khép kín, kết thúc bằng PR thật. Chạy trong main context vì cần tool `Agent` để spawn tuần tự và đọc kết quả từng bước để quyết định bước tiếp theo — các agent con không tự spawn agent khác được.

## Khi dùng
- User giao một task/phase cụ thể và muốn tự động chạy hết chu trình plan → code → verify → PR, không muốn tự tay gọi từng agent.
- KHÔNG dùng cho việc thăm dò/thảo luận kiến trúc chưa rõ phạm vi — hỏi rõ phạm vi trước khi vào Bước 1.

## Đầu vào bắt buộc trước khi bắt đầu
- Task/phase cụ thể (vd "Phase 3 — Snapshot tự động" hoặc một issue GitHub cụ thể). Nếu user chỉ nói chung chung ("làm tiếp phase tiếp theo"), đọc `process/PROCESS.md` xác định phase 🟨/⬜ tiếp theo và xác nhận lại với user trước khi chạy.

## Bước 0 — Xác định track: Full flow hay Hotfix

**Mặc định luôn là Full flow.** Chỉ vào **Hotfix track** khi user gõ rõ từ khoá ("hotfix", "fix nhanh", "sửa gấp") — **không tự phán đoán** một task là "nhỏ" để tự ý bỏ bước, kể cả khi task nhìn có vẻ đơn giản.

Khi user yêu cầu hotfix, còn phải xác nhận **cả 3 điều kiện** sau mới được bỏ gate plan (nếu thiếu 1 điều kiện, rớt về Full flow, nói rõ vì sao với user):
1. Root cause đã rõ — user chỉ thẳng file/hàm, hoặc grep ra ngay không cần điều tra nhiều bước.
2. Phạm vi sửa ≤ 2 file, không cần tạo abstraction mới.
3. Không đụng: Prisma schema, công thức domain (XIRR/cost basis/thuế), hay logic filter `userId`.

## Full flow

### Bước 1 — Plan (bắt buộc qua Plan Mode, có gate duyệt)
1. Gọi `EnterPlanMode` nếu chưa ở Plan Mode.
2. Spawn Agent `subagent_type: planner` (foreground — cần nội dung để tiếp tục), giao task cụ thể + phase liên quan.
3. Ghi nội dung plan planner trả về, gọi `ExitPlanMode` xin user duyệt. **Đây là gate bắt buộc, không bỏ qua** — mọi bước sau (sửa code, push, PR) chỉ chạy sau khi user duyệt plan.
4. User yêu cầu sửa plan → quay lại spawn `planner` với phản hồi, lặp tới khi được duyệt.

### Bước 2 — Implement
1. Từ nội dung plan, xác định cần agent nào: đụng Prisma schema/queries/Server Action/tính toán domain → `business-implementer`; đụng JSX/Tailwind/animation/skeleton → `design-implementer`; đụng cả hai thì chạy **tuần tự**, `business-implementer` trước nếu Presentational chưa tồn tại, hoặc `design-implementer` trước nếu UI mockup đã có sẵn — đọc mục UI của `phase-x.md` liên quan để biết tình trạng.
2. Spawn agent tương ứng (foreground), giao đúng phần việc trong plan.
3. Ghi lại danh sách file đã đổi mỗi agent báo cáo.

### Bước 3 — Quality verify (luôn chạy, kể cả hotfix)
1. Spawn Agent `subagent_type: quality-verifier` (foreground).
2. `KẾT QUẢ: CHƯA ĐẠT` → quay lại Bước 2, giao lại đúng lỗi (kèm nguyên văn báo cáo) cho implementer liên quan. Đếm số lần lặp.
3. `KẾT QUẢ: ĐẠT` → sang Bước 4.

### Bước 4 — E2E verify (điều kiện theo hạ tầng)
1. Trước khi spawn, tự kiểm tra hạ tầng (`echo $CLAUDE_CODE_REMOTE` theo `TOOLS.md`) — nếu Claude Cloud, **không spawn** `e2e-verifier` (tốn 1 lần cold-start chỉ để nó tự báo skip), tự ghi nhận "e2e chưa verify được trong Claude Cloud" và chuyển thẳng sang Bước 5 kèm ghi chú này.
2. Claude Local → spawn Agent `subagent_type: e2e-verifier` (foreground).
3. `KẾT QUẢ: CHƯA ĐẠT` → quay lại Bước 2 (kèm nguyên văn báo cáo), sau khi implementer sửa thì **restart từ Bước 3** (quality-verify lại, đơn giản hơn track riêng từng lỗi). Đếm số lần lặp.
4. `KẾT QUẢ: ĐẠT` → sang Bước 5.

### Bước 5 — Verify tổng hợp
1. Spawn Agent `subagent_type: verifier` (foreground), giao phase/tiêu chí cần kiểm chứng **kèm nguyên văn 2 báo cáo** của `quality-verifier` và `e2e-verifier` (hoặc ghi chú skip nếu Bước 4 bị bỏ qua vì Cloud).
2. Đọc báo cáo verifier:
   - `KẾT QUẢ: ĐẠT` → sang Bước 6.
   - `KẾT QUẢ: CHƯA ĐẠT` → quay lại Bước 2, chỉ giao lại đúng phần gap (kèm nguyên văn báo cáo) cho đúng implementer liên quan, sau đó restart từ Bước 3. Đếm số lần lặp.
3. **Giới hạn 3 lần lặp tổng cộng qua Bước 2→3→4→5.** Sau lần thứ 3 vẫn còn gap → dừng lại, báo cáo đầy đủ cho user (đã thử gì, còn vướng gì), không tự lặp thêm.

## Hotfix track (chỉ khi user yêu cầu rõ + đủ 3 điều kiện ở Bước 0)

1. **Bỏ Bước 1 (plan gate)** — thay bằng xác nhận nhẹ: nói rõ với user "đây là hotfix, sửa trực tiếp file X, không qua plan gate" trước khi động tay (không cần `EnterPlanMode`/`ExitPlanMode`).
2. **Bỏ spawn implementer riêng** — sửa trực tiếp trong main context (phạm vi đã giới hạn ≤ 2 file theo điều kiện Bước 0).
3. **Bước 3 (Quality verify): luôn chạy**, không có ngoại lệ — rẻ, là lưới an toàn cuối khi mọi gate khác đã bị bỏ.
4. **Bước 4 (E2E verify): chỉ chạy khi** bug ban đầu là triệu chứng UI/luồng người dùng (vd "bấm nút X không ra kết quả"), hoặc user yêu cầu rõ muốn xác nhận qua e2e. Nếu fix thuần backend/util đã có unit test cover đủ ca lỗi → bỏ qua bước này, ghi rõ lý do trong báo cáo cuối. Vẫn áp dụng điều kiện hạ tầng Cloud → không spawn như Full flow.
5. **Bước 5 (Verify tổng hợp): vẫn chạy** — nhưng vì hotfix không gắn `phase-x.md`, verifier sẽ tự nhận diện qua mục "hotfix ngoài phase" và không update `PROCESS.md`/tick tiêu chí, chỉ xác nhận `quality-verifier`/`e2e-verifier` (nếu có chạy) đều đạt.
6. Retry (nếu có gap): sửa trực tiếp trong main context (không spawn implementer), restart từ Bước 3. Vẫn giới hạn 3 lần lặp.
7. Kết thúc bằng Bước 6 (Đóng vòng) như Full flow.

## Bước 6 — Đóng vòng (verifier đã xác nhận đạt)
1. `git status` + `git diff` xem lại toàn bộ thay đổi (code + test verifier/e2e-verifier viết thêm + doc tiến trình nếu có).
2. Tạo commit mới (không amend), message tiếng Anh theo quy ước `CLAUDE.md`, ưu tiên giải thích "vì sao" hơn "làm gì".
3. Push lên nhánh hiện tại.
4. Kiểm tra nhánh đã có PR mở chưa (mục "Kiểm tra nhánh hiện tại đã có PR mở chưa" ở [`TOOLS.md`](../../../TOOLS.md) — tool khác nhau giữa Claude Local/Cloud); nếu chưa, spawn Agent `subagent_type: issuer` để tạo PR (base branch: theo user chỉ định nếu có, mặc định `main` nếu không — xem `issuer.md`), theo `.github/pull_request_template.md`. Nếu đã có PR mở, push ở bước trên đã tự cập nhật PR đó.

## Không làm
- Không bỏ gate duyệt plan ở Full flow dù mục tiêu là "tự động".
- Không tự ý coi 1 task là "hotfix" khi user không gõ rõ từ khoá — kể cả khi task trông đơn giản.
- Không tự sửa code thay implementer khi verifier/quality-verifier/e2e-verifier báo gap ở Full flow — luôn quay lại đúng agent implementer, giữ đúng ranh giới trách nhiệm từng agent.
- Không vượt quá 3 lần lặp mà không hỏi user.
- Không merge/close PR, không xoá branch — dừng lại sau khi PR được tạo.

## Kết thúc
Báo cáo: track đã chạy (Full/Hotfix + lý do), link PR, tóm tắt plan đã duyệt (nếu Full flow), agent nào đã chạy bao nhiêu vòng, kết quả verify cuối của cả 3 tầng (quality/e2e/tổng hợp), có gap nào phải dừng giữa chừng không.
