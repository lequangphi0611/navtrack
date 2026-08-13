# Quyết định — Quy trình agent & hạ tầng công cụ

Phạm vi: hạ tầng e2e, integration test Python, bề mặt preview, DesignSync/`design-fetcher`, gate tạo PR của `issuer`.
Tài liệu liên quan: [`HARNESS.md`](../../HARNESS.md), [`TOOLS.md`](../../TOOLS.md), [`e2e/CLAUDE.md`](../../e2e/CLAUDE.md), [`docs/rules/e2e-page-object.md`](../../docs/rules/e2e-page-object.md).

> Đây là nhóm quyết định **không** thuộc nghiệp vụ tài chính — chúng ràng buộc cách Claude làm việc trên repo này.

---

## 2026-07-14 — `pnpm e2e` chạy trên DB Postgres riêng, ephemeral

**Status:** Accepted

**`pnpm e2e` chạy trên DB Postgres riêng, ephemeral — tách hẳn khỏi DB dev.**
- Bối cảnh: trước đây `pnpm e2e` (`playwright.config.ts` webServer chạy `pnpm dev`) dùng chung `DATABASE_URL` với dev (`.env`, service `db` cổng 5433) — test và data đang thao tác tay lẫn vào cùng 1 DB.
- Quyết định: thêm service `db-test` (`docker-compose.test.yml`, project name riêng `navtrack-test`, cổng 5434, data ở tmpfs — không named volume) + `.env.test`. `pnpm e2e` đổi thành `node scripts/e2e.mjs`: tự `docker compose -f docker-compose.test.yml up --wait` → `prisma migrate deploy` vào DB test → `playwright test` (kế thừa `DATABASE_URL` đã override qua biến môi trường tiến trình con, không cần sửa `playwright.config.ts`) → `down` khi xong (kể cả fail, trong `finally`). Project name riêng đảm bảo `down` không đụng service `db` (dev) dù chung `docker-compose.yml`/network mặc định.
- Docs đã sync: `README.md` (mục "Chạy e2e"), `docs/rules/testing.md` (mục "End-to-end").

---

## 2026-07-15 — Integration test Python trên Postgres thật ephemeral

**Status:** Accepted

**Integration test Python: snapshot-cron + price-fetcher trên Postgres thật ephemeral.**
- **Tái dùng `docker-compose.test.yml`/`.env.test` cho cả 2 job** (đã là hạ tầng ephemeral độc lập, không dựng compose riêng).
- **Script Node (`scripts/python-integration-test.mjs`) orchestrate docker + migrate + pytest**, không để Python tự gọi docker (giữ ranh giới Python↔TS: chỉ chia sẻ schema Postgres).
- **snapshot-cron:** marker `@pytest.mark.integration` + `addopts = "-m 'not integration'"` trong pyproject.toml để pytest mặc định bỏ integration test (nhanh dev loop). Guard DB_URL phải là `:5434` trong fixture autouse.
- **price-fetcher:** monkeypatch `main.fetch_price` (chỉ tầng high, không mock vnstock), verify `get_symbols_to_fetch()` + idempotent trên constraint thật, tự quét tất cả job có `test_integration.py` thay hardcode tên job.
- Docs đã sync: `docs/rules/python-job.md`, `docs/rules/testing.md`, `HARNESS.md`, `README.md`, `jobs/*/README.md`.

---

## 2026-07-18 — Bề mặt preview component dev-only + Playwright MCP

**Status:** Accepted

**Bề mặt preview component dev-only + Playwright MCP — để `design-implementer` tự soi UI thay vì dựng mù.**
- Bối cảnh: `design-implementer` dựng Presentational không thấy được thành phẩm, tệ nhất với component design-first chưa wire vào route nào.
- Cấu trúc: `src/app/preview/<slug>/page.tsx` render component cô lập + sample props (import component thật, cấm chép markup). Soi qua Playwright MCP (`.mcp.json` → `scripts/playwright-mcp.mjs`). **Việc soi/chụp là của orchestrator (`dev-cycle`/main context), KHÔNG phải subagent** — ảnh chụp bên trong subagent kẹt lại đó, không tới được user; orchestrator chụp rồi `SendUserFile` để user thấy bằng chứng thật.
- **Footgun (đã trả giá khi làm):** chặn production **ở `src/proxy.ts` (trả 404 TRƯỚC khi route render)**, KHÔNG dùng `notFound()` trong page/layout — `notFound()` vẫn để Next render page rồi **nhúng markup vào payload RSC ở body 404** → lộ nội dung. Mẹo `pageExtensions` đuôi `.dev.tsx` **không dùng được** cho App Router/Turbopack (resolver khớp `tsx` trước, coi `page.dev` ≠ `page`). `force-dynamic` ở `preview/layout.tsx` để không prerender tĩnh (khỏi sinh HTML chứa sample markup trong build output).
- **Bất biến:** soi UI **không phải cổng verify** — e2e suite + unit test vẫn là source of truth (soi chỉ self-check lúc author). Chạy được cả Cloud lẫn Local vì component cô lập không cần Docker/DB (khác e2e — xem `TOOLS.md`). Trên Cloud, wrapper ép `--executable-path /opt/pw-browsers/chromium` (revision lệch sẽ fail launch).
- Docs sync: `docs/rules/component-architecture.md` (mục "Bề mặt preview" + quy tắc viết preview page), `docs/rules/testing.md`, `TOOLS.md` (dòng "Soi UI component qua browser"), `.claude/agents/design-implementer.md`, `.claude/skills/dev-cycle/SKILL.md`, `CLAUDE.md`.

---

## 2026-07-18 — `design-fetcher`: owner DUY NHẤT kéo mockup Claude Design

**Status:** Accepted — cơ chế "ai gọi `DesignSync`" đã đổi ở [2026-07-18 (3)](#2026-07-18-3--issue-76-orchestrator-gọi-designsync-thay-vì-subagent)

**`design-fetcher`: owner DUY NHẤT kéo mockup Claude Design, front-load digest cho cả chuỗi.**
- Bối cảnh: `design-implementer` tự kéo DesignSync lúc implement → mọi khâu chạy trước (`planner`, `issue-breakdown`) đều mù, không biết phase có mấy màn/component/state.
- Quyết định: tách agent `design-fetcher` chạy ĐẦU phase, là nơi **duy nhất** gọi DesignSync + ghi `.claude/design-cache/`; sinh digest `process/UI_phase_N.md` (màn → component → atom tái dùng → Props phác thảo). `design-implementer` thành **người đọc** (bỏ `DesignSync`/`ToolSearch` khỏi tools), chỉ firm up phần Props khi component thật ra đời. `planner`/`issue-breakdown`/`business-implementer` đều đọc digest.
- **Bất biến:** file mockup để kéo **do user/caller chỉ định**, `design-fetcher` KHÔNG tự suy từ số phase (`Phase {N} Screens.dc.html` chỉ là quy ước tên tham khảo); chưa rõ thì `list_files` báo lại cho người gọi chọn, không tự đoán.
- Docs sync: `.claude/agents/design-fetcher.md` (mới), `design-implementer.md`, `planner.md`, `business-implementer.md`, `.claude/skills/{dev-cycle,issue-breakdown}/SKILL.md`, `CLAUDE.md`.
- **Footgun phát hiện sau (2026-07-18):** `DesignSync` là deferred tool — nạp qua `ToolSearch` gắn với phiên hiện tại, **không lan xuống subagent** được spawn qua Agent tool dù `.claude/agents/design-fetcher.md` liệt kê `DesignSync` trong `tools`. `design-fetcher` chạy như subagent độc lập bị chặn hoàn toàn ở bước gọi `DesignSync` (mọi `ToolSearch` từ subagent đều trả "No matching deferred tools found"). Xử lý tạm: phiên chính tự gọi `DesignSync` thay khi subagent báo bị chặn — phá vỡ tạm thời bất biến "duy nhất design-fetcher gọi DesignSync". Đã log issue riêng để theo dõi/fix hạ tầng (xem GitHub issue tương ứng, tạo qua `issuer`).

---

## 2026-07-18 (3) — Issue #76: orchestrator gọi `DesignSync` thay vì subagent

**Status:** Accepted — hướng fix chính thức cho footgun ở entry trên

**Issue #76 — chốt hướng fix chính thức: chuyển trách nhiệm gọi `DesignSync` từ subagent `design-fetcher` sang orchestrator (main context).**
- Bối cảnh: footgun ghi ở entry 2026-07-18 phía trên (`design-fetcher` chạy như subagent độc lập không gọi được `DesignSync` — `ToolSearch` từ subagent luôn trả "No matching deferred tools found") mới chỉ có "xử lý tạm" (phiên chính tự gọi thay khi subagent báo bị chặn). Đã cân nhắc phương án "biến `design-fetcher` thành Skill" (chạy trong chính context gọi, né được vấn đề vì Skill không spawn session mới) nhưng loại bỏ: `get_file` có thể trả tới 256KB/file, chạy như Skill sẽ đổ thẳng raw HTML vào context của phiên điều phối (`dev-cycle`/`issue-breakdown`), làm phình context các bước sau chạy chung phiên (`planner`, `business-implementer`...) — đúng thứ mà kiến trúc "agent riêng, chỉ trả digest cô đọng" đang cố tránh.
- **Quyết định:** giữ nguyên `design-fetcher` là **agent** (không đổi sang Skill), nhưng đổi **ai** gọi `DesignSync`: orchestrator (phiên chính khi user gọi trực tiếp, hoặc `dev-cycle`/`issue-breakdown` khi điều phối tự động — luôn chạy ở main context có `DesignSync`) tự `ToolSearch select:DesignSync` → `list_files`/`get_file` → `Write` raw HTML ra `.claude/design-cache/raw/` + entry cơ bản (`designFile`, `cachedAt`) vào `index.json` **TRƯỚC KHI** spawn `design-fetcher`. `design-fetcher` bỏ `DesignSync`/`ToolSearch` khỏi `tools:`, chỉ `Read` raw cache đã có sẵn trên đĩa (không qua text response/prompt) để chưng cất digest — giữ nguyên cách ly context của kiến trúc multi-agent, không cần platform hỗ trợ gì thêm.
- Prompt spawn `design-fetcher` giờ **bắt buộc** kèm đường dẫn raw cache đã fetch; thiếu đường dẫn → `design-fetcher` dừng và báo lỗi lại người gọi (lỗi ở orchestrator chưa fetch trước, không tự đoán/tự gọi vì không còn tool đó).
- Docs đã sync: `.claude/agents/design-fetcher.md` (bỏ `DesignSync`/`ToolSearch` khỏi `tools`, đổi toàn bộ mô tả "Đầu vào"/"Nguồn mockup"/"Cache local"/"Quy trình"), `.claude/skills/dev-cycle/SKILL.md` (Bước 0b), `.claude/skills/issue-breakdown/SKILL.md` (Bước 1 mục 7).

---

## 2026-07-24 (5) — Quy ước viết e2e theo Page Object Model

**Status:** Accepted

**Chốt quy ước viết e2e theo Page Object Model + tách tài liệu e2e ra khỏi production code.**
- Bối cảnh: bộ e2e hiện tại (`e2e/*.spec.ts`) viết lối thủ tục — gọi `page.getByRole/locator` trực tiếp trong spec, trùng lặp selector nặng, có chỗ bám class Tailwind (`div.rounded-2xl.border-border`) làm selector giòn, và tri thức domain (redirect `?cashflowId=`, DatePicker input hidden, timezone lệch ngày...) nằm rải rác trong comment từng spec. Cần một quy ước để spec mới nhất quán và gom tri thức lại một nơi.
- **Quyết định:** áp dụng **Page Object Model** cho e2e — ba tầng rạch ròi: **page object** (theo màn hình, ở `e2e/pages/`, giữ URL + selector + action), **component object** (widget dùng lại xuyên màn), **fixture** cross-cutting (ở `e2e/support/`, đã có sẵn: session, dates, date-picker, urls). Spec chỉ mô tả ý định + kỳ vọng, gọi page object.
- **Chiến lược selector:** role/label-first (repo có **0 `data-testid`** — dựa vào selector khả truy cập đúng khuyến nghị Playwright); `input[name="..."]` được phép cho form field (hợp đồng ổn định với Server Action); **cấm bám class CSS/Tailwind**; `data-testid` là **ngoại lệ có kiểm soát** — chỉ thêm vào `src/` khi selector khả truy cập thật sự không phân biệt được, nêu rõ trong PR.
- **Assertion:** locator là API chính của page object, `expect` nằm ở **spec** (giữ ý định kỳ vọng dễ đọc); chỉ thêm assertion helper trong page object khi lặp ≥3 lần.
- **Tách tài liệu e2e vs production (mục tiêu token/ngữ cảnh):** tri thức e2e gom vào `e2e/` + `docs/rules/` để khi Claude làm e2e chỉ nạp context e2e, không kéo `src/` vào; page object tập trung selector giúp người viết spec không phải mở internals component. Scoped `e2e/CLAUDE.md` auto-load chỉ khi làm trong `e2e/`.
- **Phạm vi lần này: chỉ tài liệu**, không tạo `e2e/pages/` thật, không refactor spec đang xanh (tránh rủi ro vỡ test). Refactor spec cũ sang POM theo dõi ở GitHub issue riêng — spec **mới** viết theo POM ngay; spec cũ đụng tới đâu POM hoá tới đó.
- Docs đã sync: `docs/rules/e2e-page-object.md` (rule mới — gồm mục "Best practices" gom lại: test independence/isolation cho `fullyParallel`, cấm logic điều khiển trong page object, tránh trừu tượng hoá non), `docs/coding-rules.md` (index), `docs/rules/testing.md` (mục End-to-end trỏ sang), `CLAUDE.md` (root — mục "Đọc khi cần" trỏ tường minh tới `e2e/CLAUDE.md`), `e2e/CLAUDE.md` (instruction scoped), `e2e/GOTCHAS.md` (nhật ký bẫy, seed từ bug thật đã gặp).

---

## 2026-07-25 — Tách spec e2e (`*.spec.ts`) ra `e2e/tests/`

**Status:** Accepted

**Tách spec e2e (`*.spec.ts`) ra `e2e/tests/`, không còn nằm chung cấp với `pages/`/`support/`.**
- Bối cảnh: sau khi PR #97 POM hoá xong toàn bộ 9 spec (đóng issue #88), `e2e/` có 9 file `*.spec.ts` nằm ngang hàng với 2 thư mục hạ tầng (`pages/`, `support/`) ngay tại root — khó phân biệt nhanh đâu là test thật, đâu là code dùng chung khi liệt kê thư mục.
- **Quyết định:** chuyển toàn bộ `*.spec.ts` vào `e2e/tests/`; `pages/`, `support/`, `CLAUDE.md`, `GOTCHAS.md` giữ nguyên vị trí (ngang hàng với `tests/`, không lồng vào trong). `playwright.config.ts` đổi `testDir` sang `./e2e/tests`. Import trong spec từ `./pages/...`/`./support/...` đổi thành `../pages/...`/`../support/...`.
- Docs đã sync: `e2e/CLAUDE.md` (bản đồ thư mục), `docs/rules/e2e-page-object.md` (sơ đồ cấu trúc mục 3 + các path ví dụ), `docs/rules/testing.md` (path ví dụ), `.claude/agents/verifier.md` + `.claude/agents/e2e-verifier.md` (phạm vi sửa `e2e/tests/*.spec.ts`).

---

## 2026-08-12 — Từ chối Neon cho e2e trên Cloud; thêm process gate ở `issuer`

**Status:** Accepted

**Từ chối hướng "thay Docker bằng Neon cho e2e trên Claude Cloud" — thêm process gate (`issuer` bắt buộc biết trạng thái e2e trước khi tạo PR) để đóng lỗ hổng đã ghi ở 2026-07-26 (7) thay vì mang DB thật lên Cloud.**

- Bối cảnh: user đề xuất thay `docker-compose.test.yml` (Postgres ephemeral, tmpfs, tự sạch khi container down) bằng 1 connection string DB online (Neon) để Claude Cloud (không có Docker daemon) cũng tự chạy được `pnpm e2e` thật thay vì chỉ soi UI qua Playwright MCP. Lo ngại chính do user tự nêu: dữ liệu test không được dọn sạch hợp lý giữa các lần chạy.
- **Từ chối hướng Neon.** Lo ngại của user đúng và thực chất nghiêm trọng hơn "tồn dư dữ liệu" — là **race/corruption thật**. Bộ e2e hiện tại được thiết kế với giả định chỉ 1 runner sở hữu toàn bộ DB tại một thời điểm: `playwright.config.ts` đã hạ `workers` xuống 1 chính vì lỗi race khi nhiều test cùng sửa `Setting`/`PriceQuote` dùng chung (`e2e/GOTCHAS.md` #14); cái "sạch" hiện tại đến từ việc **cả container bị huỷ và dựng lại** (tmpfs, không named volume), không phải từ logic dọn dữ liệu trong code. Một Neon URL cố định dùng chung giữa nhiều phiên Claude Cloud chạy song song sẽ tái tạo đúng loại race đó ở quy mô lớn hơn (2 phiên cùng `prisma migrate deploy`/`db seed`/thao tác chung 1 `userId` test) — có thể làm giảm độ tin cậy của e2e như "lưới an toàn" thay vì cải thiện nó. Đưa 1 connection string dùng chung vào cả 2 phiên còn **chủ động phá bỏ** sự cô lập tự nhiên đang có hôm nay (mỗi sandbox Cloud là máy riêng, không ai cầm credential DB nào).
- Neon Database Branching (branch-per-run, gần tương đương tmpfs) có thể giữ đúng tinh thần ephemeral, nhưng là một khoản đầu tư hạ tầng riêng (project Neon tách khỏi prod để không ăn compute-hour vào ngân sách ~$0/tháng, kênh inject secret an toàn cho Cloud mà `TOOLS.md` chưa mô tả có tồn tại, cleanup + reaper theo TTL phòng process bị kill giữa chừng) — không tương xứng quy mô app cá nhân 1-2 người dùng. Để ngỏ cho tương lai nếu mục tiêu đổi thành "Cloud phải tự verify e2e độc lập, không phụ thuộc chờ Local".
- **Gốc rễ thật của "nửa số phiên Cloud không có lưới an toàn" (2026-07-26 (7)) không hoàn toàn do thiếu DB trên Cloud, mà do quy trình thiếu gate cứng chặn merge khi PR được tạo từ phiên e2e mới `SKIP`.** `dev-cycle` (Bước 6) vẫn tự commit → push → tạo PR dù e2e chưa từng chạy thật, không có tín hiệu nào cảnh báo trên PR — checkbox `pnpm e2e pass` trong `.github/pull_request_template.md` có thể bị tick nhầm hoặc bị bỏ qua khi review.
- **Quyết định:** `issuer` bắt buộc nhận trạng thái e2e (`ĐẠT`/`CHƯA ĐẠT`/`SKIP`/`N/A`, mặc định an toàn coi như `SKIP` nếu không được truyền — không tự đoán, không tự chạy `pnpm e2e` để xác nhận thay) từ người gọi khi giao việc tạo PR, phản ánh qua 3 lớp: banner cảnh báo là dòng đầu tiên của PR body khi khác `ĐẠT`/`N/A`, checkbox `pnpm e2e pass` trong Test plan để đúng thực tế (không tự tick), và **tạo PR ở trạng thái Draft** khi khác `ĐẠT`/`N/A` (gate cơ học thật — GitHub tự ẩn nút Merge — thay vì chỉ dựa vào chữ cảnh báo dễ lướt qua khi review; best-effort, tool không hỗ trợ tham số draft thì vẫn tạo PR thường kèm banner/checkbox). `dev-cycle` Bước 6 forward nguyên văn trạng thái e2e đã xác định ở Bước 4/5 khi spawn `issuer`.
- **Không sửa `.github/pull_request_template.md`.** Banner chỉ nên xuất hiện có điều kiện (khi thực sự SKIP/CHƯA ĐẠT/chưa xác định) — một banner tĩnh nằm sẵn trong template sẽ buộc mọi PR (kể cả PR tạo tay, e2e đã chạy thật) phải nhìn thấy/tự xoá tay, nhiễu và dễ quên xoá đúng lúc cần giữ. Chèn động lúc tạo PR (việc của `issuer`, nơi duy nhất biết trạng thái e2e thật) sạch hơn, không cần đồng bộ 2 nơi mỗi khi đổi câu chữ banner.
- **Không thêm label GitHub cho PR** — `TOOLS.md` chưa liệt kê tool gắn label PR cho cả 2 hạ tầng; banner + checkbox + Draft đã đủ rõ, không cần thêm phụ thuộc tool mới.
- **Giới hạn đã biết:** cơ chế chỉ áp dụng lúc tạo PR — `issuer` không mở rộng quyền sang sửa/update PR đã có (chuyển Draft → Ready, tick lại checkbox sau khi rerun e2e pass trên Local là thao tác tay của người xác nhận, giữ đúng phạm vi "chỉ tạo PR" hiện tại của `issuer`).
- Docs đã sync: `.claude/agents/issuer.md`, `.claude/skills/dev-cycle/SKILL.md`.

---

## 2026-08-13 — `pnpm e2e` chạy được trên Claude Cloud qua Postgres native (không Docker)

**Status:** Accepted

**Cho phép Claude Cloud tự chạy `pnpm e2e` thật bằng Postgres cài trực tiếp trong sandbox (không qua Docker), tách phần cài đặt ra một setup script riêng của environment thay vì chạy trong `scripts/e2e.mjs`.**

- Bối cảnh: user hỏi có cách nào để Claude Cloud verify chức năng bằng thao tác UI thật (Playwright) sau khi implement, dù không có Docker daemon. Đây khác câu hỏi đã bị từ chối ở **2026-08-12** (Neon) — hướng đó bị từ chối vì Neon là 1 DB **dùng chung** giữa nhiều phiên Cloud chạy song song (tái tạo race đã biết ở `e2e/GOTCHAS.md` #14, phá cô lập tự nhiên của sandbox). Câu hỏi lần này khác về bản chất: Postgres cài **bên trong 1 sandbox**, không chia sẻ với phiên nào khác — cùng tính cô lập như Docker Compose trên Local, chỉ thay "container" bằng "process". Đã spike thật (không suy đoán) trên chính sandbox Cloud đang chạy: `apt-get install postgresql` cài + start được (sandbox chạy quyền root), full round-trip xác nhận qua `pnpm db:migrate:deploy` + `pnpm db:seed` + `pnpm dev` + `curl` trang `/sign-in` (HTTP 200) + query lại DB thấy đúng row vừa seed — rồi chạy thật `pnpm e2e`, **45/45 test pass** trên Postgres native.
- **Quyết định:** `scripts/e2e.mjs` rẽ nhánh theo `CLAUDE_CODE_REMOTE` — Local giữ nguyên `docker-compose.test.yml`; Cloud dùng Postgres native lắng nghe cổng mặc định 5432 (không cần đổi sang 5434 như `.env.test` vì Cloud không bao giờ chạy DB dev song song để đụng cổng), tự `DROP DATABASE IF EXISTS` + `CREATE DATABASE` trước mỗi lần chạy để giữ đúng bất biến "sạch từ đầu mỗi lần chạy" (tmpfs của Docker tự làm việc này bằng cách huỷ container; Cloud không có container nên phải tự làm bằng SQL).
- **Tách việc CÀI ĐẶT ra khỏi repo hoàn toàn — theo yêu cầu tường minh của user, sau khi đã thử một phương án khác.** Bản đầu tiên nhét cả `apt-get install`/`service start`/tạo role vào trong `scripts/e2e.mjs` (chạy mỗi lần `pnpm e2e`, có kiểm tra idempotent nên không cài lại nếu đã có) — chạy thật, pass 45/45. Bản thứ hai tách phần cài đặt ra một file riêng commit trong repo (`scripts/cloud-postgres-setup.sh`). User từ chối cả hai: **việc cài đặt hệ thống không nên nằm trong repo dưới bất kỳ hình thức nào** — đây là cấu hình của **environment** (Claude Code on the web có sẵn khái niệm "setup script" chạy lúc provision container, cấu hình trong phần settings của environment, không phải file trong git). Chốt: nội dung script chỉ tồn tại dạng tài liệu (README.md mục "Chạy e2e trên Claude Cloud") để user tự copy vào ô cấu hình đó; repo không sở hữu, không chạy, không track file cài đặt này. `scripts/e2e.mjs` trên Cloud giờ CHỈ `pg_isready` (check) rồi DROP+CREATE (reset) — không tự cài gì, không biết gì về cách Postgres được cài.
- **Vì sao tách khỏi cả `scripts/e2e.mjs` lẫn repo:** cài `postgresql` qua `apt-get` mất vài giây tới ~1 phút (network tới Ubuntu archive) — lặp lại kiểm tra idempotent này ở *mỗi lần* `pnpm e2e` là chi phí thừa nếu environment đã ổn định qua nhiều phiên. Đưa hẳn ra khỏi repo (thay vì chỉ tách file) đúng ranh giới trách nhiệm: **repo mô tả ứng dụng**, **environment mô tả hạ tầng chạy ứng dụng** — cách cài Postgres hệ điều hành không phải thứ đổi theo commit của navtrack, không có lý do sống trong git history của app.
- **Giới hạn đã biết:** phụ thuộc user tự dán nội dung script vào ô cấu hình environment (thao tác ngoài phạm vi Claude Code — trong UI Claude Code on the web, Claude không có tool nào chỉnh cấu hình environment); nếu chưa cấu hình, Cloud vẫn ở trạng thái "skip" như trước — nhưng giờ skip có lý do rõ ràng, kiểm chứng được (`pg_isready` fail), không còn là blanket "Cloud luôn skip" nữa. Role `navtrack` tạo với `SUPERUSER` (khớp hành vi `POSTGRES_USER` mặc định của image Docker chính thức đang dùng ở `docker-compose.yml`) — chấp nhận được vì đây là DB test/dev ephemeral trong sandbox riêng, không phải DB production. Vì script không nằm trong repo, không có gì đảm bảo nội dung user dán vào environment luôn khớp bản mới nhất trong README.md — nếu sau này đổi role/port/tên DB trong `scripts/e2e.mjs`, phải nhắc user tự cập nhật lại script phía environment.
- Docs đã sync: `TOOLS.md` (dòng "Chạy E2E test"), `HARNESS.md` (mục "Verify khi hoàn thành"), `README.md` (mục mới "Chạy e2e trên Claude Cloud" — chứa nội dung script để copy), `docs/rules/testing.md` (2 chỗ: "nửa số phiên" + "DB riêng, ephemeral"), `e2e/CLAUDE.md` (mục "Cách chạy"), `.claude/agents/e2e-verifier.md` (bỏ auto-skip cứng trên Cloud, đổi theo tín hiệu `pg_isready` fail thật), `scripts/e2e.mjs`, `playwright.config.ts` (ép `executablePath` Chromium có sẵn trên Cloud — lỗi phát sinh độc lập với DB, do `@playwright/test` pin revision khác bản browser đã cài sẵn ở `/opt/pw-browsers`).
- **Footgun phát hiện sau (cùng ngày, khi user dán script thật vào environment):** `apt-get update -qq` thoát exit 100 (`set -e` giết cả script) vì 2 PPA bên thứ 3 đã cấu hình sẵn trên environment (`deadsnakes`, `ondrej/php` — không liên quan gì tới Postgres) trả 403/"no longer signed" qua proxy của hạ tầng. Lúc spike trong session Claude Code (index apt đã có cache từ trước) cùng 2 PPA đó chỉ log **warning** (`W:`) chứ không chặn; trên environment thật (chưa có cache) cùng lỗi lại thành **error** (`E:`) khiến `apt-get update` trả exit khác 0. Vá bằng `apt-get update -qq || true` — chấp nhận archive Ubuntu chính vẫn fetch được dù PPA phụ lỗi, không cần lo whitelist/sửa nguồn PPA đó (ngoài phạm vi script này). Đã cập nhật script trong README.md; chưa re-verify trên environment thật (user tự dán lại và báo kết quả).

---

## Quyết định liên quan ở file khác

- "Rút phần thuần ra khỏi vỏ, KHÔNG mock Prisma" và lỗ hổng "nửa số phiên Cloud không có lưới an toàn" — [`architecture-and-code-quality.md`](./architecture-and-code-quality.md), mục 2026-07-26 điểm (7).
- Đối chiếu mockup Phase 5 / Phase 6 do `design-fetcher` kéo về — [`tax-and-fees.md`](./tax-and-fees.md) mục 2026-07-18 (2), [`pricing-and-valuation.md`](./pricing-and-valuation.md) mục 2026-07-21 (2).
