import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

const PUBLIC_PATH_PREFIXES = [ROUTES.signIn, ROUTES.apiAuth];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Bề mặt preview component là DEV-ONLY (soi UI component cô lập, xem
  // docs/rules/component-architecture.md). Proxy là nơi chặn — chạy TRƯỚC khi
  // route render:
  // - Production: trả 404 ngay, page KHÔNG render → không sinh payload RSC để lộ
  //   markup (guard `notFound()` trong page không đủ vì Next vẫn nhúng nội dung
  //   page đã render vào body 404).
  // - Dev: cho qua mà không cần đăng nhập, để soi UI không vướng auth.
  if (pathname.startsWith(ROUTES.preview)) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(null, { status: 404 });
    }
    return;
  }

  const isPublic = PUBLIC_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL(ROUTES.signIn, req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
