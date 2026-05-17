export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

// 5 signup attempts per IP per 15 minutes.
const SIGNUP_MAX = 5;
const SIGNUP_WINDOW_MS = 15 * 60 * 1000;

function tooManyResponse(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many signup attempts. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = rateLimit({
    key: `signup:ip:${ip}`,
    max: SIGNUP_MAX,
    windowMs: SIGNUP_WINDOW_MS,
  });
  if (!ipLimit.ok) return tooManyResponse(ipLimit.retryAfter);

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { name, email, password: hashed, role: "USER" } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
