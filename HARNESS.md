# HARNESS.md — quyền hạn của Claude Code trên repo này

Mô tả các quy tắc `permissions.allow` / `permissions.deny` cấu hình trong
[`.claude/settings.json`](./.claude/settings.json) — quyết định lệnh nào Claude được chạy
thẳng, lệnh nào bị chặn cứng. Đây là tài liệu giải thích **vì sao**, không phải chỗ để đọc
cấu hình thô (xem trực tiếp file JSON cho danh sách chính xác).

## Nguyên tắc

- **Allow:** lệnh dùng hằng ngày, an toàn hoặc dễ hoàn tác (chạy dev server, test, lint,
  build, migrate DB local, git read-only + các thao tác ghi thông thường). Không cần hỏi
  lại mỗi lần, tăng tốc vòng lặp làm việc.
- **Deny:** lệnh phá hoại hoặc khó/không hoàn tác — **chặn cứng, không hỏi lại để bỏ qua**.
  Nếu thực sự cần chạy một trong các lệnh này, người dùng phải tự chạy tay ngoài Claude
  Code, không phải việc Claude tự quyết định.
- **Phủ cả hai shell:** máy dev chính chạy Windows, Claude Code có thể gọi lệnh qua tool
  `Bash` (Git Bash / POSIX sh) hoặc tool `PowerShell` (Windows PowerShell 5.1). Quyền hạn
  được khai theo tool (`Bash(...)` / `PowerShell(...)`), nên mỗi rule phải khai **hai lần** —
  một cho mỗi tool — nếu không lệnh tương đương ở shell còn lại sẽ không được nhận diện.

## Allow — lệnh thường dùng

Lấy từ script trong [`package.json`](./package.json) + Docker Compose + git cơ bản:

| Nhóm                          | Lệnh                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm                          | `install`, `add`, `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `test` (kể cả `test:watch`), `e2e`, `db:migrate`, `db:seed`, `exec`, `dlx`                                                                                                                                              |
| Python (`jobs/price-fetcher`) | `pip install -r requirements*` (chỉ cài từ file `requirements*.txt` có sẵn, không cài package tuỳ ý); `pytest`/`python -m pytest`; `ruff check`/`ruff format` (kể cả qua `python -m ruff`); mỗi lệnh có thêm biến thể gọi thẳng `.venv/Scripts/python.exe` (Windows venv, khi PATH chưa activate) |
| Docker                        | `docker compose up`, `down`, `ps`, `logs`; `docker ps`                                                                                                                                                                                                                                            |
| Git (đọc)                     | `status`, `diff`, `log`, `show`, `branch` (liệt kê/xem)                                                                                                                                                                                                                                           |
| Git (ghi, an toàn)            | `checkout -b <tên nhánh mới>`, `add`, `commit`, `push` (không kèm `--force`), `push origin <ref>`, `pull`, `fetch`                                                                                                                                                                                |
| GitHub CLI                    | `gh issue *` — tạo/xem/sửa/comment issue (báo bug, đề xuất tính năng) theo template ở `.github/ISSUE_TEMPLATE/`; `gh pr create` — tạo PR theo `.github/pull_request_template.md`                                                                                                                  |

Lý do các lệnh này an toàn để auto-allow: đều là lệnh **đọc**, hoặc lệnh **ghi nhưng dễ
hoàn tác** (commit sai thì sửa/revert được, push thường (không force) không đè lịch sử
người khác, tạo nhánh mới không ảnh hưởng nhánh khác). `gh issue *` cũng thuộc nhóm dễ
hoàn tác — issue tạo nhầm có thể đóng/xóa; riêng `gh issue delete` bản thân `gh` vẫn hỏi
xác nhận nếu không kèm `--yes`, nên rủi ro thấp. `gh pr create` chỉ **tạo** PR (không merge,
không force-push kèm theo) — PR tạo nhầm đóng lại được, không ảnh hưởng lịch sử hay nhánh
người khác; các thao tác PR nguy hiểm hơn (`gh pr merge`, `gh pr close --delete-branch`...)
**không** nằm trong allow-list, vẫn rơi vào hỏi xác nhận.

Nhóm Python cố ý **hẹp hơn** các lệnh `pnpm` tương ứng: `pip install -r requirements*`
chỉ khớp khi có `-r requirements...` (cài từ file lock có sẵn trong repo), **không** phải
`pip install*` khớp mọi gói — cài package tuỳ ý (kể cả từ PyPI công khai) không phải hành vi
đọc/dễ hoàn tác như cài từ `requirements.txt` đã review, nên vẫn rơi vào hỏi xác nhận. Tương
tự, `python main.py` (chạy job thật — ghi `PriceQuote`) **không** nằm trong allow-list, chỉ
`pytest`/`ruff` (test/lint, không đụng DB) mới auto-allow.

## Deny — lệnh nguy hiểm, chặn cứng

| Lệnh                                                                                                                  | Vì sao chặn                                                     |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `rm -rf` / `rm -fr` (Bash), `Remove-Item -Recurse -Force` / `rd /s /q` (PowerShell)                                   | Xóa file/thư mục đệ quy, không hoàn tác được                    |
| `git reset --hard`                                                                                                    | Xóa vĩnh viễn thay đổi chưa commit trong working tree           |
| `git rebase`                                                                                                          | Viết lại lịch sử commit — dễ mất commit, xung đột khó xử lý sai |
| `git push --force`, `-f`, `--force-with-lease` (kể cả dạng `git push origin <ref> --force`/`-f`/`--force-with-lease`) | Ghi đè lịch sử trên remote, có thể mất commit của người khác    |
| `git clean -f`                                                                                                        | Xóa vĩnh viễn file chưa track                                   |
| `git checkout -- .` / `git checkout .` / `git restore .`                                                              | Bỏ hết thay đổi chưa commit trong working tree                  |
| `git branch -D` / `--delete --force`                                                                                  | Xóa nhánh kể cả khi chưa merge, mất commit chưa đẩy lên remote  |

**Giới hạn của cơ chế match theo prefix:** rule khớp theo _tiền tố chuỗi lệnh_, nên viết
lại tham số theo thứ tự khác (vd `Remove-Item -Force -Recurse` thay vì
`-Recurse -Force`) có thể lách qua rule deny cụ thể. Ví dụ cụ thể đã gặp: rule allow
`git push origin *` khớp cả `git push origin <ref> --force` (vì `*` khớp mọi thứ sau
`origin `), trong khi các rule deny gốc chỉ khớp khi `--force`/`-f`/`--force-with-lease`
đứng ngay sau `git push` — nên lệnh force-push gắn sau `origin <ref>` lọt qua deny và bị
allow duyệt thẳng. Đã vá bằng cách thêm rule deny riêng cho dạng
`git push origin * --force*`/`-f*`/`--force-with-lease*`. Danh sách deny ở trên chặn các
cách viết phổ biến nhất; với các lệnh xóa file không nằm trong danh sách allow, hành vi mặc
định vẫn là **hỏi xác nhận** trước khi chạy — đây là lớp bảo vệ dự phòng cho các biến thể
chưa liệt kê.

## Verify khi hoàn thành

Sau khi sửa code, chạy đúng lệnh verify theo loại code đã đụng vào **trước khi báo xong việc**
— các lệnh này đều đã nằm trong allow-list ở trên, không cần hỏi xác nhận.

| Đã sửa                                                    | Chạy gì để verify                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code TypeScript/Next.js (app chính, `src/`, `prisma/`)    | `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` — **`pnpm e2e` (Playwright) luôn chạy**, kể cả khi thay đổi có vẻ không đụng UI (business logic/query/action vẫn có thể phá luồng end-to-end mà unit test không bắt được); thêm `pnpm build` nếu đổi cấu hình Next/route                                                                                                                                                                                   |
| Schema Prisma (`prisma/schema.prisma`)                    | `pnpm prisma generate` rồi `pnpm prisma migrate dev` (tạo + áp migration local) trước khi `pnpm typecheck`/`pnpm test` — client Prisma phải đồng bộ schema mới build đúng; sau đó **vẫn chạy `pnpm e2e`** như mọi thay đổi TypeScript/Next.js ở trên — đổi schema (cột/kiểu/constraint) có thể phá luồng thật dù `typecheck`/unit test đều xanh (unit test không chạm DB thật)                                                                                    |
| Job Python (`jobs/price-fetcher/`, `jobs/snapshot-cron/`) | Trong thư mục job: `pytest` (mặc định loại `integration`, nhanh) rồi `ruff check .` và `ruff format --check .`; cả `jobs/price-fetcher/` và `jobs/snapshot-cron/` đều đã có `test_integration.py` — chạy thêm `pnpm test:python-integration` ở gốc repo trước khi báo xong (tự quét cả 2 job trong 1 lần `docker compose up`/`down`) — verify idempotent/giá trị trên DB thật. Không tự chạy `python main.py` (ghi thật) trừ khi cần verify tích hợp có chủ đích. |

Lệnh nào fail thì sửa rồi chạy lại — không báo hoàn thành khi verify chưa sạch. Đây là quy
tắc quy trình tham khảo (đọc bằng mắt/tự áp dụng), **không phải hook tự động** — không có gì
tự chặn nếu bỏ qua bước này; xem `docs/rules/*` để biết chi tiết lint/test rule từng mảng.

**Bảng trên viết cho Claude Local (hạ tầng tối thiểu bắt buộc).** Các bước cần Docker (`pnpm
e2e`, `pnpm test:python-integration`, `docker compose up`) không chạy được trên Claude Cloud
(không có Docker daemon) — xem [`TOOLS.md`](./TOOLS.md) để biết việc nào skip trên Claude
Cloud và việc nào vẫn bắt buộc. Trên Claude Cloud, báo rõ "chưa verify e2e được ở đây" thay vì
báo pass giả; verify thật (kể cả `pnpm e2e`) vẫn phải chạy trên Claude Local trước khi coi là
xong việc.

## Khi cần lệnh không có trong allow

Mọi lệnh không khớp `allow` lẫn `deny` sẽ rơi vào **hỏi xác nhận** (hành vi mặc định của
Claude Code) — không tự động chặn, không tự động chạy. Điều chỉnh danh sách allow/deny
trực tiếp trong `.claude/settings.json` khi quy trình làm việc thay đổi (vd thêm script
mới vào `package.json`).
