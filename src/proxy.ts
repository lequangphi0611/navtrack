import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

const PUBLIC_PATH_PREFIXES = ["/sign-in", "/api/auth"];

export default auth((req) => {
  const isPublic = PUBLIC_PATH_PREFIXES.some((prefix) =>
    req.nextUrl.pathname.startsWith(prefix),
  );

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
