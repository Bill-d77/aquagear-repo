export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
});

// 5 review writes per user per hour — stops scripted review-bombing.
const REVIEW_MAX = 5;
const REVIEW_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit({ key: `review:user:${user.id}`, max: REVIEW_MAX, windowMs: REVIEW_WINDOW_MS });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many reviews. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { productId, rating, comment } = parsed.data;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.isArchived) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // One review per user per product — posting again replaces the previous one.
    const review = await prisma.review.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      create: { userId: user.id, productId, rating, comment },
      update: { rating, comment },
    });

    return NextResponse.json({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      userName: user.name,
      createdAt: review.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("POST /api/mobile/reviews:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
