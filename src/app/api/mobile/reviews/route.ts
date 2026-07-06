export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile";

const schema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const review = await prisma.review.create({
      data: { userId: user.id, productId, rating, comment },
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
