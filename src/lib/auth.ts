import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit, getClientIpFromHeaders } from "./rate-limit";

// 10 login attempts per IP per 10 minutes, and 5 per (email) per 10 minutes.
// The email bucket protects a specific account even if the attacker rotates IPs.
const LOGIN_IP_MAX = 10;
const LOGIN_EMAIL_MAX = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

const resolvedSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "development" ? "dev-secret-change-me" : undefined);

if (process.env.NODE_ENV === "production" && !resolvedSecret) {
  throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be set in production");
}

export const authConfig: NextAuthConfig = {
  secret: resolvedSecret,
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(credentials);
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;

        // Rate-limit before doing any DB or bcrypt work so flooders don't
        // exhaust CPU even when they're being rejected. We bucket by both IP
        // and email so neither axis on its own can be abused.
        const reqHeaders = await headers();
        const ip = getClientIpFromHeaders(reqHeaders);
        const normalizedEmail = email.toLowerCase();

        const ipLimit = rateLimit({
          key: `login:ip:${ip}`,
          max: LOGIN_IP_MAX,
          windowMs: LOGIN_WINDOW_MS,
        });
        if (!ipLimit.ok) {
          console.warn(`Login rate limit (ip) tripped for ${ip}`);
          return null;
        }

        const emailLimit = rateLimit({
          key: `login:email:${normalizedEmail}`,
          max: LOGIN_EMAIL_MAX,
          windowMs: LOGIN_WINDOW_MS,
        });
        if (!emailLimit.ok) {
          console.warn(`Login rate limit (email) tripped for ${normalizedEmail}`);
          return null;
        }

        try {
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            return null;
          }
          const ok = await bcrypt.compare(password, user.password);
          if (!ok) {
            return null;
          }
          return { id: user.id, name: user.name, email: user.email, role: user.role };
        } catch (error) {
          console.error("Authorize error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role;
      return session;
    }
  }
};

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth(authConfig);
