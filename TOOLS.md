# TOOLS.md — bảng tool theo hạ tầng (Claude Cloud vs Claude Local)

Navtrack được code trên 2 hạ tầng Claude Code khác nhau, và **không phải tool nào cũng có ở
cả hai**: dùng nhầm (hardcode tool của hạ tầng này trong lúc đang chạy hạ tầng kia) khiến agent
chạy nửa chừng rồi fail, hoặc tệ hơn — báo verify "pass" giả vì lệnh chưa từng thật sự chạy.
File này là **nguồn duy nhất** (source of truth) trả lời "công việc X thì dùng tool gì, ở hạ
tầng nào" — mọi agent/skill khác trỏ về đây thay vì tự hardcode.

## Hai loại hạ tầng

- **Claude Local (CLI)** — máy dev chính (Windows, Git Bash/PowerShell). Có `gh` CLI đã
  login, có Docker Desktop chạy được `docker compose`. Đây là hạ tầng **tối thiểu bắt buộc**:
  mọi thứ phải chạy được ở đây trước khi coi là xong việc.
- **Claude Cloud (web/remote sandbox)** — container tạm, không có `gh` CLI (dùng GitHub MCP
  tool thay), có binary `docker` nhưng **không có Docker daemon chạy** (`docker ps` báo lỗi
  không kết nối được socket `/var/run/docker.sock`) → mọi việc cần Docker phải **skip**, không
  tự bịa cách chạy thay thế.

## Cách xác định hạ tầng đang chạy

```bash
echo "$CLAUDE_CODE_REMOTE"   # "true" -> Claude Cloud; rỗng/unset -> Claude Local
```

Đây là tín hiệu chính thức, đủ dùng cho phần lớn trường hợp — không cần probe từng tool
(`which gh`, `docker ps`...) trừ khi cần chắc chắn riêng 1 tool còn đúng như mô tả trong bảng
dưới hay không (vd nghi ngờ bảng đã lỗi thời so với thực tế).

## Quy ước dùng chung

Mọi agent (`.claude/agents/*.md`) và skill (`.claude/skills/*/SKILL.md`) khi mô tả một công
việc có tính hạ tầng-phụ-thuộc phải:

1. Dùng đúng cụm từ ở cột **Công việc** bên dưới (không diễn giải lại bằng câu khác) — đây là
   ngôn ngữ mô tả dùng chung giữa mọi agent/skill.
2. Trỏ link `TOOLS.md` thay vì hardcode tên tool/lệnh ngay trong file agent/skill đó.

Khi có công việc hạ tầng-phụ-thuộc mới, thêm 1 dòng vào bảng này trước, rồi mới cho agent/skill
liên quan trỏ về đây — sửa một chỗ là đồng bộ hết, không phải lục sửa từng agent.

## Bảng tool theo hạ tầng

| Công việc                                                       | Claude Cloud                                                                                                            | Claude Local (bắt buộc)                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Tạo Pull Request                                                  | `mcp__github__create_pull_request`                                                                                        | `gh pr create`                                                  |
| Kiểm tra nhánh hiện tại đã có PR mở chưa                          | `mcp__github__list_pull_requests` (filter theo head branch)                                                               | `gh pr list --head <branch>`                                    |
| Tạo / sửa GitHub issue                                            | `mcp__github__issue_write` (method `create`/`update`)                                                                     | `gh issue create` / `gh issue edit`                             |
| Xem nội dung issue hoặc PR (chi tiết, comment, label...)          | `mcp__github__issue_read` / `mcp__github__pull_request_read`                                                              | `gh issue view` / `gh pr view`                                  |
| Liệt kê issue                                                     | `mcp__github__list_issues`                                                                                                | `gh issue list`                                                 |
| Comment vào issue hoặc PR                                         | `mcp__github__add_issue_comment`                                                                                          | `gh issue comment` / `gh pr comment`                            |
| Khởi động Postgres qua Docker Compose (dev hoặc test)             | **Skip** — không có Docker daemon; không tự chạy `docker compose up`, không tự bịa cách thay thế                          | `docker compose up -d --wait`                                   |
| Chạy E2E test (Playwright, cần Postgres qua Docker Compose)       | **Skip** — phụ thuộc Docker ở trên; báo rõ cho user "chưa verify e2e được trong Claude Cloud", **không** báo pass giả     | `pnpm e2e` — bắt buộc trước khi báo hoàn thành (xem `HARNESS.md`) |
| Chạy integration test Python (`jobs/*`, cần Docker Compose)       | **Skip** — cùng lý do trên                                                                                                 | `pnpm test:python-integration` — bắt buộc khi phase đụng job Python |
| Lint / typecheck / unit test / build                              | `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` — chạy bình thường, không phụ thuộc `gh`/Docker                | như cột Claude Cloud                                            |
| Xác định hạ tầng đang chạy                                        | `echo $CLAUDE_CODE_REMOTE` → `true`                                                                                        | biến rỗng/không set                                             |

## Khi bảng chưa có công việc cần dùng

Chưa có dòng tương ứng trong bảng → **dừng lại, hỏi user** thay vì tự đoán tool nào dùng được
trên hạ tầng hiện tại — đặc biệt các lệnh `gh` khác ngoài bảng, hoặc lệnh cần gọi mạng ra ngoài.
Sau khi thống nhất, thêm dòng mới vào bảng này (không chỉ dùng 1 lần rồi quên).

## Tự giới thiệu đầu session

`SessionStart` hook (`.claude/hooks/session-start.sh`) tự detect `CLAUDE_CODE_REMOTE` và bơm
context vào đầu conversation — câu trả lời đầu tiên mỗi session sẽ tự xưng "Claude Cloud" hoặc
"Claude Local" trước khi vào nội dung chính, để user xác nhận ngay hạ tầng đang chạy có đúng
với phát hiện tự động hay không, không cần tự hỏi/tự đoán.
