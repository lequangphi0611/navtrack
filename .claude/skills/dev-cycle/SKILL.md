---
name: dev-cycle
description: Điều phối tự động vòng đời triển khai một task Navtrack — spawn agent planner → business-implementer/design-implementer → verifier tuần tự, lặp lại implementer nếu verifier báo gap, rồi tự commit → push → tạo PR qua issuer khi verifier xác nhận đạt. Dùng khi user muốn giao hẳn một task/phase để tự chạy hết chu trình thay vì tự tay từng bước.
---

# Dev Cycle — điều phối planner → implementer → verifier

Skill này điều phối 3 agent đã có trong dự án (`planner`, `business-implementer`/`design-implementer`, `verifier`) chạy thành một vòng lặp khép kín cho một task/phase cụ thể, kết thúc bằng PR thật. Chạy trong main context vì cần tool `Agent` để spawn tuần tự và đọc kết quả từng bước để quyết định bước tiếp theo — các agent con không tự spawn agent khác được.

## Khi dùng
- User giao một task/phase cụ thể và muốn tự động chạy hết chu trình plan → code → verify → PR, không muốn tự tay gọi từng agent.
- KHÔNG dùng cho việc thăm dò/thảo luận kiến trúc chưa rõ phạm vi — hỏi rõ phạm vi trước khi vào Bước 1.

## Đầu vào bắt buộc trước khi bắt đầu
- Task/phase cụ thể (vd "Phase 3 — Snapshot tự động" hoặc một issue GitHub cụ thể). Nếu user chỉ nói chung chung ("làm tiếp phase tiếp theo"), đọc `process/PROCESS.md` xác định phase 🟨/⬜ tiếp theo và xác nhận lại với user trước khi chạy.

## Vòng lặp

### Bước 1 — Plan (bắt buộc qua Plan Mode, có gate duyệt)
1. Gọi `EnterPlanMode` nếu chưa ở Plan Mode.
2. Spawn Agent `subagent_type: planner` (foreground — cần nội dung để tiếp tục), giao task cụ thể + phase liên quan.
3. Ghi nội dung plan planner trả về, gọi `ExitPlanMode` xin user duyệt. **Đây là gate bắt buộc, không bỏ qua** — mọi bước sau (sửa code, push, PR) chỉ chạy sau khi user duyệt plan.
4. User yêu cầu sửa plan → quay lại spawn `planner` với phản hồi, lặp tới khi được duyệt.

### Bước 2 — Implement
1. Từ nội dung plan, xác định cần agent nào: đụng Prisma schema/queries/Server Action/tính toán domain → `business-implementer`; đụng JSX/Tailwind/animation/skeleton → `design-implementer`; đụng cả hai thì chạy **tuần tự**, `business-implementer` trước nếu Presentational chưa tồn tại (để design bám đúng data shape thật), hoặc `design-implementer` trước nếu UI mockup đã có sẵn từ trước (giống Phase 2 — UI đã xong, chỉ còn nối business) — đọc mục UI của `phase-x.md` liên quan để biết tình trạng.
2. Spawn agent tương ứng (foreground), giao đúng phần việc trong plan.
3. Ghi lại danh sách file đã đổi mỗi agent báo cáo.

### Bước 3 — Verify
1. Spawn Agent `subagent_type: verifier` (foreground), giao phase/tiêu chí cần kiểm chứng.
2. Đọc báo cáo verifier:
   - **Đạt hết** → sang Bước 4.
   - **Còn gap** → quay lại Bước 2, chỉ giao lại đúng phần gap (kèm nguyên văn báo cáo verifier) cho đúng implementer liên quan. Đếm số lần lặp.
3. **Giới hạn 3 lần lặp Bước 2↔3.** Sau lần thứ 3 vẫn còn gap → dừng lại, báo cáo đầy đủ cho user (đã thử gì, còn vướng gì), không tự lặp thêm.

### Bước 4 — Đóng vòng (verifier đã xác nhận đạt + tự cập nhật `process/PROCESS.md`/`phase-x.md`)
1. `git status` + `git diff` xem lại toàn bộ thay đổi (code + test verifier viết thêm + doc tiến trình).
2. Tạo commit mới (không amend), message tiếng Anh theo quy ước `CLAUDE.md`, ưu tiên giải thích "vì sao" hơn "làm gì".
3. Push lên nhánh hiện tại.
4. Kiểm tra nhánh đã có PR mở chưa (mục "Kiểm tra nhánh hiện tại đã có PR mở chưa" ở [`TOOLS.md`](../../../TOOLS.md) — tool khác nhau giữa Claude Local/Cloud); nếu chưa, spawn Agent `subagent_type: issuer` để tạo PR (base `main`, theo `.github/pull_request_template.md`). Nếu đã có PR mở, push ở bước trên đã tự cập nhật PR đó.

## Không làm
- Không bỏ qua gate duyệt plan ở Bước 1 dù mục tiêu là "tự động".
- Không tự sửa code thay implementer khi verifier báo gap — luôn quay lại đúng agent implementer, giữ đúng ranh giới trách nhiệm từng agent.
- Không vượt quá 3 lần lặp Bước 2↔3 mà không hỏi user.
- Không merge/close PR, không xoá branch — dừng lại sau khi PR được tạo.

## Kết thúc
Báo cáo: link PR, tóm tắt plan đã duyệt, agent nào đã chạy bao nhiêu vòng, kết quả verify cuối, có gap nào phải dừng giữa chừng không.
