---
name: issue-breakdown
description: Chia một phase (`process/phase-x.md`) hoặc một cụm việc lớn thành các GitHub issue độc lập, đúng convention Navtrack — dùng đúng template `.github/ISSUE_TEMPLATE/*`, gắn nhãn `phase-N`, tách issue Design & UI riêng (Presentational thuần, không business logic) làm trước khi UI chưa có sẵn, và ghi rõ quan hệ phụ thuộc bằng SỐ ISSUE THẬT giữa các issue tạo ra. Dùng khi user muốn "chia task"/"log issue" cho một phase hoặc một mảng việc lớn, thay vì tạo tay từng issue.
---

# Issue Breakdown — chia phase/cụm việc thành GitHub issue có phụ thuộc rõ ràng

Skill này tạo một loạt issue GitHub cho một phase hoặc một mảng việc lớn của Navtrack, theo đúng mẫu đã dùng cho Phase 3 (issue #34–#37): tách theo ranh giới agent/công cụ, design-first khi UI chưa có, và **ghi số issue thật** ở mục phụ thuộc (không để trống "sẽ ghi sau" nếu tránh được).

## Khi dùng
- User giao một phase cụ thể (vd "chia issue cho Phase 4") hoặc một cụm việc lớn chưa có issue nào ("log issue chia nhỏ việc X ra cho tôi").
- **Không** dùng để tự triển khai code — skill này chỉ tạo issue. Muốn triển khai thật, dùng `dev-cycle` sau khi issue đã có.

## Đầu vào bắt buộc trước khi bắt đầu
- Phạm vi cụ thể: số phase (đọc `process/phase-x.md` tương ứng) hoặc mô tả cụm việc. Nếu user chỉ nói chung chung, đọc `process/PROCESS.md` xác định phase 🟨/⬜ tiếp theo và xác nhận lại trước khi đọc tiếp.

## Bước 1 — Đọc bối cảnh
1. `process/phase-x.md` liên quan — mục "Công việc cần làm", "Tiêu chí hoàn thành", "Phụ thuộc/ghi chú".
2. `process/DECISION.md` — quyết định đã chốt ở phase trước, tránh đề xuất đi ngược.
3. `process/PROCESS.md` — phase trước đã xong chưa (Phase N phụ thuộc Phase N-1 theo `03-roadmap.md`).
4. `docs/domain/*` liên quan tới phase — mỗi issue business phải trích dẫn đúng file/mục domain doc làm căn cứ, không tự suy diễn rule.
5. `docs/02-data-model.md` nếu phase đụng schema mới — bản nháp model có thể đã có sẵn ở đây, chỉ cần hiện thực vào `prisma/schema.prisma`.
6. `docs/rules/*` liên quan (đặc biệt `python-job.md` nếu phase có job chạy GitHub Actions, `component-architecture.md` nếu có UI mới) — quyết định ranh giới ngôn ngữ/công cụ của từng việc.
7. Nếu phase đã có UI dựng sẵn từ trước (đã tồn tại `process/UI_phase_x.md`) — đọc để biết Props contract có sẵn, KHÔNG cần issue Design & UI riêng nữa.
8. Kiểm tra trùng: liệt kê issue đang mở gắn nhãn `phase-N` (GitHub MCP `list_issues` với `labels: ["phase-N"]`, hoặc `gh issue list --label phase-N` nếu có `gh` CLI) — không tạo lại việc đã có issue.

## Bước 2 — Chia nhỏ theo nguyên tắc

- **Schema/migration luôn tách issue riêng, làm trước tiên** nếu phase có model Prisma mới — mọi issue khác trong phase phụ thuộc issue này (không có bảng thì chưa ghi được gì).
- **UI/Presentational chưa có sẵn → tách 1 issue "Design & UI" riêng**, đúng ranh giới agent `design-implementer` (`.claude/agents/design-implementer.md`): không viết `queries.ts`, không Server Action, không đụng Prisma, dùng mock/sample data, output là component + `process/UI_phase_N.md` (Props contract từng component, theo đúng format `process/UI_phase_2.md`: bảng trạng thái wiring, `type Props`, sample data). Issue này **không phụ thuộc** issue schema (làm song song được) — chỉ các issue business cần Props contract của nó mới phụ thuộc nó.
  - Nếu UI **đã có sẵn** (đã có `UI_phase_N.md` từ đầu phase, như Phase 2 lúc bắt đầu) → bỏ qua bước này, các issue business đọc thẳng Props contract có sẵn.
- **Khác ngôn ngữ/công cụ → luôn tách issue riêng**, dù cùng phục vụ một tính năng (vd job Python chạy GitHub Actions vs Server Action TS trong app — xem mẫu #36 vs #37 của Phase 3). Không gộp việc thuộc 2 ranh giới agent khác nhau vào một issue.
- **Mỗi issue là một khối việc một agent làm gọn trong một lượt** — đúng ranh giới `business-implementer` HOẶC `design-implementer`, không gộp cả hai loại việc.
- **Việc chỉ là hệ quả/bất biến có sẵn, không phát sinh code mới** (vd "mốc hôm nay tính động, không lưu" — đã đúng từ trước) → **không** tạo issue riêng, ghi chú gộp vào issue liên quan gần nhất nếu cần nhắc lại.
- Việc còn mơ hồ / có nhiều cách làm hợp lý (vd chọn constraint `@@unique` nào, gọi lại logic TS hay viết lại bằng ngôn ngữ khác) → **không tự chốt thay** — nêu rõ trong issue là quyết định cần xác nhận lúc implement, kèm các phương án đã nghĩ tới (đúng mẫu #34, #36 đã làm), để `process/DECISION.md` được cập nhật khi ai đó thật sự implement.

## Bước 3 — Soạn nội dung từng issue

- Dùng đúng file template theo loại việc: đa số việc chia từ phase mới là `.github/ISSUE_TEMPLATE/feature_request.md`; dùng `bug_report.md`/`refactor.md` nếu đúng bản chất hơn. Điền đủ mọi mục, **không đổi cấu trúc template**.
- Tiêu đề: `[Feature] Phase N — <tên việc ngắn>` (khớp cách đặt tên đã dùng cho #34–#37).
- Nhãn: `phase-N` + nhãn mặc định của template (`enhancement`/`bug`/`refactor`).
- Mục "Phạm vi ảnh hưởng" (từ `feature_request.md`) tick đúng theo việc đó có đổi domain/data model/rule/chỉ UI.
- Mục "Việc cần làm": checklist cụ thể theo file/hàm sẽ đụng, không viết chung chung.
- Mục cuối **"Phụ thuộc"** (thêm vào cuối issue, ngoài cấu trúc template gốc — đã là quy ước riêng của phase 2-3): ghi rõ **phụ thuộc issue nào** (số issue thật nếu đã tạo, hoặc "sẽ tạo sau, ghi rõ số issue khi có" nếu issue phụ thuộc nó chưa tồn tại) và **issue nào có thể làm song song**.

## Bước 4 — Tạo issue theo đúng thứ tự phụ thuộc

1. Tạo issue **không phụ thuộc issue nào trong phase trước** (thường là schema + design/UI) trước.
2. Tạo tiếp issue phụ thuộc chúng — ở mục "Phụ thuộc", điền **số issue thật** vừa tạo ở bước 1 (không còn "sẽ tạo sau").
3. Nếu một issue tạo trước (bước 1) có ghi tạm "sẽ tạo sau, ghi rõ số issue khi có" cho một issue tạo sau — **bắt buộc quay lại `issue_write` method `update`** điền đúng số issue thật ngay sau khi issue đó được tạo (đúng như đã làm cho #35 sau khi #37 ra đời). Không bỏ sót bước này.

**Công cụ tạo issue:**
- Có `gh` CLI khả dụng (Claude Code chạy cục bộ) → spawn `Agent` với `subagent_type: issuer` cho từng issue, giao đúng nội dung đã soạn — giữ đúng ranh giới `.claude/agents/issuer.md` (chỉ `gh issue *`/`gh pr create`, không merge/close).
- Không có `gh` CLI (Claude Code on the web/remote — chỉ có GitHub MCP tools, xem hướng dẫn môi trường trong system prompt) → dùng thẳng `mcp__github__issue_write` (method `create`/`update`) + `mcp__github__list_issues` để check trùng ở Bước 1. Tự áp đúng các quy tắc nội dung mà agent `issuer` đáng lẽ áp dụng (đọc file template thật trước khi soạn, không tự sáng tác cấu trúc khác).

## Xác nhận trước khi tạo hàng loạt

Trước khi gọi issue thật đầu tiên, hiện cho user một bảng nháp ngắn (tên việc, 1 dòng tóm tắt, phụ thuộc dự kiến) để xác nhận nhanh phạm vi chia — tạo issue tuy dễ hoàn tác (đóng/xoá được) nhưng tạo sai hướng hàng loạt vẫn tốn công dọn. **Bỏ qua bước xác nhận này** nếu user đã nói rõ kiểu "cứ tạo luôn"/"không cần hỏi lại".

## Không làm
- Không tự viết code/migration/component thật — skill này chỉ tạo issue mô tả việc cần làm.
- Không merge/close/xoá issue có sẵn.
- Không tạo issue trùng việc đã có issue mở cùng nhãn phase.
- Không gộp hai loại việc khác ranh giới agent/ngôn ngữ vào một issue.
- Không tự chốt các quyết định kỹ thuật còn mơ hồ thay người sẽ implement — nêu rõ là điểm cần xác nhận, không âm thầm chọn một phương án rồi coi như đã chốt.

## Kết thúc
Trả về bảng tổng kết: số issue thật, tên, nhãn, phụ thuộc (ai chờ ai, ai làm song song được) + gợi ý thứ tự làm hợp lý. Chủ động hỏi lại user có case biên nào trong domain doc chưa được issue nào phủ không (như đã làm ở Phase 3: backfill dữ liệu lịch sử, phạm vi để dành cho phase sau) trước khi coi là xong — đừng mặc định 4-5 issue là luôn đủ, đối chiếu lại với "Tiêu chí hoàn thành" của `phase-x.md` từng mục một.
