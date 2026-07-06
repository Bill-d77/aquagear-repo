export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { signMobileToken } from "@/lib/mobile";

// Same budget as the web login: 10/IP and 5/email per 10 minutes.
const LOGIN_IP_MAX = 10;
const LOGIN_EMAIL_MAX = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = rateLimit({ key: `mlogin:ip:${ip}`, max: LOGIN_IP_MAX, windowMs: LOGIN_WINDOW_MS });
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const emailLimit = rateLimit({
      key: `mlogin:email:${email.toLowerCase()}`,
      max: LOGIN_EMAIL_MAX,
      windowMs: LOGIN_WINDOW_MS,
    });
    if (!emailLimit.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const mobileUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = await signMobileToken(mobileUser);
    return NextResponse.json({ token, user: mobileUser });
  } catch (e) {
    console.error("POST /api/mobile/auth/login:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
