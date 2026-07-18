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
7. **Digest mockup `process/UI_phase_N.md`** (do `design-fetcher` sinh) — nếu phase đụng UI mà digest **chưa có**, spawn Agent `subagent_type: design-fetcher` (foreground) **trước** để có bản kê màn hình → component → atom tái dùng → Props phác thảo, rồi mới chia issue theo đó (không mù). **Truyền đúng file mockup user chỉ định** (design-fetcher không tự suy từ số phase); user chưa nói rõ thì hỏi trước. Có digest rồi thì đọc thẳng.
   - **Lưu ý:** digest tồn tại **không** đồng nghĩa UI đã dựng xong — nó chỉ là bản kế hoạch từ mockup. Vẫn phải kiểm component thật trong `src/` (Bước 2) để quyết còn cần issue "Design & UI" hay không.
8. Kiểm tra trùng: liệt kê issue đang mở gắn nhãn `phase-N` (mục "Liệt kê issue" ở [`TOOLS.md`](../../../TOOLS.md), filter theo `phase-N`) — không tạo lại việc đã có issue.

## Bước 2 — Chia nhỏ theo nguyên tắc

- **Schema/migration luôn tách issue riêng, làm trước tiên** nếu phase có model Prisma mới — mọi issue khác trong phase phụ thuộc issue này (không có bảng thì chưa ghi được gì).
- **Component Presentational chưa dựng → tách 1 issue "Design & UI" riêng**, đúng ranh giới agent `design-implementer` (`.claude/agents/design-implementer.md`): không viết `queries.ts`, không Server Action, không đụng Prisma, đọc digest `process/UI_phase_N.md` (do `design-fetcher` seed) + sample data, output là component + preview page (`src/app/preview/<slug>/`) + firm up phần Props của digest. Issue này **không phụ thuộc** issue schema (làm song song được) — chỉ các issue business cần Props contract của nó mới phụ thuộc nó.
  - Phân biệt rõ: **digest `UI_phase_N.md` có sẵn** (design-fetcher đã seed) ≠ **component đã dựng**. Chỉ bỏ issue "Design & UI" khi **component thật đã tồn tại trong `src/`** (grep `features/*/components`, `src/components`) — không chỉ vì file digest tồn tại.
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
3. Nếu một issue tạo trước (bước 1) có ghi tạm "sẽ tạo sau, ghi rõ số issue khi có" cho một issue tạo sau — **bắt buộc quay lại (qua `issuer`) sửa issue đó** điền đúng số issue thật ngay sau khi issue phụ thuộc được tạo (đúng như đã làm cho #35 sau khi #37 ra đời). Không bỏ sót bước này.

**Công cụ tạo issue:** spawn `Agent` với `subagent_type: issuer` cho **mỗi** issue (tạo mới lẫn update số issue thật ở bước 3), giao đúng nội dung đã soạn — `issuer` tự xác định đúng tool theo hạ tầng đang chạy (mục "Tạo / sửa GitHub issue" ở [`TOOLS.md`](../../../TOOLS.md): `gh issue create`/`edit` trên Claude Local, `mcp__github__issue_write` trên Claude Cloud) và giữ đúng ranh giới của nó (`.claude/agents/issuer.md` — chỉ issue + tạo PR, không merge/close). Skill này **không tự phân nhánh** `gh` CLI vs GitHub MCP hay tự soạn/gọi tool GitHub thay `issuer`.

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
