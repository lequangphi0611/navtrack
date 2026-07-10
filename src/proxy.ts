import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

const PUBLIC_PATH_PREFIXES = [ROUTES.signIn, ROUTES.apiAuth];

export default auth((req) => {
  const isPublic = PUBLIC_PATH_PREFIXES.some((prefix) =>
    req.nextUrl.pathname.startsWith(prefix),
  );

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL(ROUTES.signIn, req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
