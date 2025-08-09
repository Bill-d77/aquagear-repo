import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const id = String(form.get("id"));
  await prisma.product.delete({ where: { id } });
  return NextResponse.redirect(new URL("/admin/products", req.url));
}
