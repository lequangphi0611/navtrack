import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cache } from "react";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [Google],
  pages: { signIn: ROUTES.signIn },
  callbacks: {
    async signIn({ user, profile }) {
      if (!profile?.email_verified || !user.email) return false;

      const allowed = await db.allowedUser.findUnique({
        where: { email: user.email },
      });

      if (!allowed || allowed.revokedAt) {
        logger.warn(
          { email: user.email },
          "sign-in rejected: not on allowlist",
        );
        return false;
      }

      return true;
    },
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});

// Dedupe auth() trong cùng một lượt RSC render (database session strategy nghĩa là
// mỗi auth() là 1 round-trip DB) — chỉ dùng ở Server Component/query/action, KHÔNG
// dùng trong middleware (Edge runtime, ngoài request scope của React cache()).
// Tự reset mỗi request nên không vi phạm yêu cầu thu hồi tức thời (docs/domain/08).
export const getSession = cache(auth);
