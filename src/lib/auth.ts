import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

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
