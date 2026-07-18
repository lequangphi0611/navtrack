// Launcher cho Playwright MCP server (soi UI component qua browser).
//
// `.mcp.json` trỏ vào file này thay vì gọi thẳng `@playwright/mcp` vì cấu hình
// khác nhau giữa 2 hạ tầng (xem TOOLS.md, dòng "Soi UI component qua browser"):
//
// - Claude Cloud (CLAUDE_CODE_REMOTE=true): Chromium cài sẵn ở
//   /opt/pw-browsers, KHÔNG được tải browser mới (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1).
//   Ép `--executable-path` vào binary có sẵn để tránh MCP đòi revision khác rồi
//   fail launch.
// - Claude Local: để Playwright tự resolve browser (máy dev có Chromium riêng
//   qua @playwright/test).
//
// `.mcp.json` là một file commit chung, không branch theo hạ tầng được — nên
// việc rẽ nhánh nằm ở đây, đúng pattern các wrapper khác (scripts/e2e.mjs).
import { spawn } from "node:child_process";

const isCloud = process.env.CLAUDE_CODE_REMOTE === "true";

// Binary đã cài sẵn trên Cloud (symlink tới chrome-linux/chrome của bản
// chromium khớp @playwright/test trong repo).
const CLOUD_CHROMIUM = "/opt/pw-browsers/chromium";

// Ảnh screenshot rơi vào thư mục cố định (gitignored) để main context biết chỗ
// đọc rồi gửi cho user qua SendUserFile.
const args = [
  "--headless",
  "--browser",
  "chromium",
  "--output-dir",
  ".playwright-mcp",
];

if (isCloud) {
  args.push("--executable-path", CLOUD_CHROMIUM);
}

// Chạy bản @playwright/mcp khai trong devDependencies (cần `pnpm install` đã
// chạy trước — như mọi lệnh khác của repo) — không tải runtime. `pnpm exec`
// resolve bin cục bộ (`playwright-mcp` là tên bin của package @playwright/mcp).
const child = spawn("pnpm", ["exec", "playwright-mcp", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
