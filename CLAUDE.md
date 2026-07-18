# CLAUDE.md

Hướng dẫn cho Claude khi làm việc trên **Navtrack** — web app quản lý danh mục đầu tư cá nhân (cổ phiếu, quỹ, trái phiếu, vàng), tính lãi/lỗ theo XIRR. Phi thương mại, nhiều user riêng tư.

## Bắt buộc đọc trước khi code
Đọc **mọi lần**, bất kể đang làm phần nào — nền tảng chung của cả dự án:
- **README:** [`README.md`](./README.md) — cách cài đặt, chạy app local, chạy e2e (Playwright), setup job Python.
- **Coding rules:** [`docs/coding-rules.md`](./docs/coding-rules.md) — index trỏ tới rules từng mảng trong `docs/rules/`. **Tuân thủ khi viết code.**
- **Domain specs:** [`docs/domain/README.md`](./docs/domain/README.md) — luật nghiệp vụ chính xác (XIRR, cost basis, thuế, cổ tức, pricing, access...).
- **Data model:** [`docs/02-data-model.md`](./docs/02-data-model.md) — schema Prisma.
- **Tech stack:** [`docs/04-tech-stack.md`](./docs/04-tech-stack.md).
- **Business overview:** [`docs/business-overview.md`](./docs/business-overview.md).

## Đọc khi cần (theo ngữ cảnh)
Chỉ cần mở khi việc đang làm chạm đúng phần liên quan:
- **AGENTS.md:** [`AGENTS.md`](./AGENTS.md) — **đọc trước khi viết code đụng tới API/quy ước của Next.js**. Dự án dùng Next.js 16 (rất mới so với kiến thức huấn luyện của model) — có breaking changes về API/cấu trúc file so với các bản Next.js cũ quen thuộc. Trỏ tới `node_modules/next/dist/docs/` để tra API/convention chính xác thay vì suy đoán từ training data.
- **Từng file `docs/rules/*`:** đọc file tương ứng khi code phần đó (vd sửa Prisma schema → `docs/rules/schema.md` + `data-prisma.md`; sửa job Python → `python-job.md`; dựng component → `component-architecture.md`).
- **`process/phase-x.md`:** đọc phase đang làm (xem `process/PROCESS.md` để biết đang ở phase nào).
- **HARNESS.md:** [`HARNESS.md`](./HARNESS.md) — quyền hạn lệnh (`allow`/`deny`) cấu hình ở `.claude/settings.json`. Đọc khi cần chạy lệnh lạ chưa chắc được phép, khi sửa `.claude/settings.json`, hoặc **vừa sửa xong code — đọc mục "Verify khi hoàn thành" trước khi báo hoàn thành** (lệnh verify tương ứng theo loại code đã đụng vào: TS/Next.js, Prisma schema, hay job Python).
- **TOOLS.md:** [`TOOLS.md`](./TOOLS.md) — Navtrack chạy trên 2 hạ tầng Claude Code khác nhau (Claude Local/CLI vs Claude Cloud/web), không phải tool nào cũng có ở cả hai (vd `gh` CLI, Docker daemon chỉ có ở Local). **Đọc trước khi dùng bất kỳ tool nào có tính hạ tầng-phụ-thuộc** (tạo PR/issue, comment, chạy e2e, dùng Docker...) — tra bảng "Công việc → tool theo hạ tầng", dùng đúng cụm mô tả trong đó, không tự hardcode giả định tool nào có sẵn. Đầu mỗi session, `SessionStart` hook tự detect hạ tầng và khiến Claude tự xưng "Claude Cloud"/"Claude Local" trong câu trả lời đầu tiên — xem file để biết cơ chế.
- **Báo bug / đề xuất tính năng:** tạo GitHub issue bằng `gh issue create` theo template ở [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/) (repo bật `blank_issues_enabled: false` → **bắt buộc dùng template**; PR theo `.github/pull_request_template.md`). Lệnh `gh issue *` được auto-allow — xem HARNESS.md.
- **Custom agents:** [`.claude/agents/`](./.claude/agents/) — subagent chuyên trách, mỗi agent tự mô tả đầy đủ ở frontmatter (harness tự liệt kê khi cần, không cần chép lại). Hiện có:
  - `business-implementer` — hiện thực lớp business/domain: Prisma schema & migration, `queries.ts`, Server Action, tính toán domain (XIRR, cost basis, thuế, dòng tiền).
  - `design-fetcher` — owner DUY NHẤT của việc kéo mockup Claude Design (DesignSync), chạy ĐẦU phase trước planner/design-implementer; sinh digest `process/UI_phase_N.md` (màn → component → atom tái dùng → Props phác thảo) để cả chuỗi cùng đọc thay vì mỗi agent tự kéo.
  - `design-implementer` — hiện thực lớp UI/Presentational: component hiển thị, styling theo token, animation, skeleton, empty/error state (đọc digest mockup do `design-fetcher` sinh, không tự kéo DesignSync); viết preview page `src/app/preview/<slug>/` để soi UI.
  - `issuer` — thao tác GitHub issue + tạo PR (`gh issue *`, `gh pr create`); không merge/close PR.
  - `curator` — làm gọn nhật ký `process/PROCESS.md` và rút gọn `process/DECISION.md`.
  - `planner` — lên kế hoạch triển khai (implementation plan) cho một task, dùng ở Phase 2 (Design) của Plan Mode thay cho Plan agent mặc định; viết dễ hiểu, plan luôn kết thúc bằng verify (`HARNESS.md`) → commit → push → tạo PR qua `issuer`.
  - `quality-verifier` — chạy lệnh verify cơ học (lint/typecheck/unit test/build theo `HARNESS.md`), rẻ và nhanh, chạy trước tiên; không phán đoán nghiệp vụ, không viết test, không chạy e2e.
  - `e2e-verifier` — kiểm thử luồng chính từ góc nhìn người dùng bằng Playwright, viết thêm e2e test còn thiếu; cần Docker nên chỉ chạy trên Claude Local, skip trên Claude Cloud theo `TOOLS.md`.
  - `verifier` — tầng tổng hợp cuối: nhận báo cáo của `quality-verifier` + `e2e-verifier`, đối chiếu tiêu chí `phase-x.md` với bằng chứng thật, grep nhanh 2 quy ước lõi (`userId`, `Decimal`), được viết thêm unit test còn thiếu; không sửa code production, không viết e2e, không tự fix lỗi tìm thấy. Là nơi duy nhất tick `phase-x.md`/`PROCESS.md`.
- **Custom skills:** [`.claude/skills/`](./.claude/skills/). Hiện có:
  - `dev-cycle` — điều phối tự động (`design-fetcher` khi phase đụng UI) → `planner` → `business-implementer`/`design-implementer` → soi UI qua Playwright MCP → `quality-verifier` → `e2e-verifier` → `verifier` cho một task/phase, lặp lại implementer khi có gap (tối đa 3 lần), rồi tự commit → push → tạo PR qua `issuer` khi verifier xác nhận đạt. Có track rút gọn cho hotfix (chỉ khi user gõ rõ từ khoá, đủ điều kiện mới bỏ bớt bước) — xem `dev-cycle/SKILL.md`. Dùng khi muốn giao hẳn một task để tự chạy hết chu trình.
  - `issue-breakdown` — chia một phase hoặc cụm việc lớn thành các GitHub issue đúng convention (template `.github/ISSUE_TEMPLATE/*`, nhãn `phase-N`, tách issue Design & UI riêng khi UI chưa có sẵn, ghi rõ phụ thuộc bằng số issue thật). Dùng khi mới bắt đầu một phase, trước khi giao việc cho `dev-cycle`.

## Tiến trình triển khai
- **Theo dõi tại [`process/PROCESS.md`](./process/PROCESS.md)** — trỏ tới chi tiết từng phase (`process/phase-x.md`).
- **Trước khi bắt đầu một phase mới, đọc [`process/DECISION.md`](./process/DECISION.md)** — quyết định quan trọng đã chốt ở các phase trước (đổi rule/schema/kiến trúc + lý do), tránh làm trái hoặc lặp lại tranh luận đã xong.
- **QUAN TRỌNG:** mỗi khi hoàn thành một phase, **cập nhật `process/PROCESS.md`** (đổi trạng thái) và tick tiêu chí trong `process/phase-x.md`.

## Đồng bộ tài liệu khi có quyết định quan trọng
- **BẮT BUỘC:** mỗi khi có quyết định quan trọng làm thay đổi **business / domain / spec / data model / rules**, phải **phản ánh đầy đủ vào TẤT CẢ tài liệu liên quan** trong cùng lần thay đổi — không chỉ sửa một chỗ.
- Rà các nơi có thể bị ảnh hưởng và cập nhật cho nhất quán: `docs/business-overview.md`, `docs/domain/*`, `docs/02-data-model.md`, `docs/04-tech-stack.md`, `docs/03-roadmap.md`, `docs/rules/*` (+ index), `process/phase-x.md` (tiêu chí phase).
- **Ghi lại quyết định + lý do vào [`process/DECISION.md`](./process/DECISION.md)** — không ghi vào `PROCESS.md`, file đó chỉ theo dõi tiến độ ngắn gọn (xem "Nhật ký" trong `PROCESS.md`). Giữ **cross-reference đồng bộ**: đổi tên/khái niệm ở một file thì cập nhật mọi chỗ tham chiếu (dùng grep để tìm hết).
- Commit riêng cho thay đổi tài liệu với message mô tả quyết định.

## Tech stack (tóm tắt)
- Next.js + TypeScript (App Router), Prisma + PostgreSQL (Neon), Auth.js + Google OAuth (database sessions).
- Tailwind + shadcn/ui, Recharts. XIRR: thư viện + lớp bọc kiểm tra.
- Giá tự động: job **Python + vnstock** trên GitHub Actions ghi `PriceQuote`; app **chỉ đọc**.
- Hosting: Vercel + Neon + GitHub Actions (chi phí ~$0).

## Quy ước cốt lõi (chi tiết ở rules)
- **pnpm**; TS strict + `noUncheckedIndexedAccess`; ESLint + Prettier.
- **Component:** PascalCase, mỗi component một thư mục `Name/Name.tsx` + `index.ts`; Server Component làm container, Presentational thuần. File non-component kebab-case.
- **Tiền luôn `Decimal`**, không float. Convert `Decimal → string` ở biên server.
- **Tách dữ liệu theo user:** mọi truy vấn filter theo `userId` từ session (`auth()`), không tin client.
- **Ranh giới Python↔TS:** chỉ chia sẻ schema Postgres; Prisma sở hữu migration; job Python không chạy migration.
- **Lỗi & log:** phân loại lỗi lường trước (`ActionResult`) vs bất ngờ (`error.tsx`); log bằng **pino**, không log secret.

## Ngôn ngữ
- Code, comment, commit message: **tiếng Anh**. Tài liệu (`docs/`, `process/`): tiếng Việt.
