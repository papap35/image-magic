import type { NextAuthOptions, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { buildUserUpsertData } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptToken } from "@/lib/tokenCrypto";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: `openid email profile ${DRIVE_SCOPE}`,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile, account }) {
      if (!profile?.email || !(profile as Profile & { sub?: string }).sub) {
        return false;
      }
      const data = buildUserUpsertData(profile as { sub: string; email: string; name?: string | null; picture?: string | null });
      // Google only returns a refresh_token on the first consent grant, so only
      // overwrite the stored one when we actually receive a new one.
      const refreshToken = account?.refresh_token;
      const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : null;
      await prisma.user.upsert({
        where: { googleId: data.googleId },
        create: { ...data, driveRefreshToken: encryptedRefreshToken },
        update: encryptedRefreshToken ? { ...data, driveRefreshToken: encryptedRefreshToken } : data,
      });
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      if (profile && (profile as { sub?: string }).sub) {
        token.googleId = (profile as { sub: string }).sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.googleId) {
        const user = await prisma.user.findUnique({ where: { googleId: token.googleId as string } });
        if (user) {
          session.user = { ...session.user, id: user.id, name: user.name, image: user.avatarUrl };
        }
      }
      return session;
    },
  },
};
