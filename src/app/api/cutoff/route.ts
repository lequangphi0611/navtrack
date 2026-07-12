import { type NextRequest, NextResponse } from "next/server";

import { CUTOFF_COOKIE_NAME, isValidCutoffKey } from "@/lib/cutoff-cookie";
import { ROUTES } from "@/lib/routes";

// Route handler trung gian cho CutoffPicker (Settings, mockup 2e) — Server
// Component KHÔNG được set cookie lúc render, nên lựa chọn mốc chốt phải đi
// qua đây (GET, Link thật) thay vì searchParams. Xem process/DECISION.md
// "Wire mốc chốt thật" cho lý do đầy đủ.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const key = request.nextUrl.searchParams.get("key");
  // Đích redirect LUÔN hardcode ROUTES.settings — không nhận redirectTo từ
  // query, tránh open-redirect.
  const response = NextResponse.redirect(new URL(ROUTES.settings, request.url));

  if (key && isValidCutoffKey(key)) {
    response.cookies.set(CUTOFF_COOKIE_NAME, key, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
