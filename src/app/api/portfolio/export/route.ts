import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { getPortfolioExport } from "@/features/holdings/queries/portfolio-export";

// Route handler tải danh mục dạng JSON cho fin-report-analyzer (issue #151).
// proxy.ts (middleware) đã redirect unauthenticated trước khi vào đây — check
// 401 ở đây chỉ là phòng thủ thêm.
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getPortfolioExport(session.user.id);
  const filename = `navtrack-portfolio-${payload.as_of.slice(0, 10)}.json`;

  return NextResponse.json(payload, {
    headers: { "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
