import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

// Guard chống xói mòn "use client" (issue #110) — *Screen/*Section/layout.tsx
// PHẢI là Server Component (docs/rules/component-architecture.md "Cấm 'use
// client' ở *Screen / *Section / layout.tsx"): đánh dấu một component là
// client kéo MỌI component nó import cũng thành client, dễ vô tình biến cả
// cây Dashboard thành client bundle chỉ vì một onClick lá. DashboardScreen là
// ca cụ thể từng cố ý tránh bug này (RSC-freezing, xem DashboardScreenClient.tsx)
// — test này quét TOÀN BỘ src để bắt hồi quy, không chỉ riêng Dashboard.
const SRC_DIR = join(import.meta.dirname, "..");

// Khớp *Screen.tsx, *Section.tsx (bất kỳ đâu trong src/) và layout.tsx (đúng
// tên file, không phải hậu tố) — cùng phạm vi lệnh grep ở CLAUDE.md/HARNESS.md
// dùng để verify thủ công.
const CLIENT_BOUNDARY_FILE_PATTERN = /(Screen|Section)\.tsx$|^layout\.tsx$/;

const IGNORED_DIR_NAMES = new Set(["node_modules", ".next"]);

function collectMatchingFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      files.push(...collectMatchingFiles(join(dir, entry.name)));
      continue;
    }
    if (CLIENT_BOUNDARY_FILE_PATTERN.test(entry.name)) {
      files.push(join(dir, entry.name));
    }
  }

  return files;
}

// "use client" chỉ có hiệu lực khi là directive Ở ĐẦU file (dòng non-blank
// đầu tiên, trước mọi import khác) — kiểm tra đúng dòng đầu tiên, không phải
// substring bất kỳ đâu trong file (tránh false positive từ comment nhắc tới
// "use client").
function hasUseClientDirective(filePath: string): boolean {
  const content = readFileSync(filePath, "utf-8");
  const firstNonEmptyLine = content
    .split("\n")
    .find((line) => line.trim().length > 0);
  const normalized = firstNonEmptyLine?.trim().replace(/;$/, "");
  return normalized === '"use client"' || normalized === "'use client'";
}

describe("component boundary — *Screen/*Section/layout.tsx không được là Client Component", () => {
  test('không file *Screen.tsx, *Section.tsx, layout.tsx nào có "use client" ở đầu file', () => {
    const files = collectMatchingFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0); // guard: pattern quét đúng, không rỗng do lỗi path

    const offenders = files.filter(hasUseClientDirective);

    expect(offenders).toEqual([]);
  });
});
