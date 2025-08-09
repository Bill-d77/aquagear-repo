import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  const pass = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@aquagear4.com" },
    update: {},
    create: { name: "Admin", email: "admin@aquagear4.com", password: pass, role: "ADMIN" }
  });

  const cat = await prisma.category.upsert({
    where: { name: "Life Jackets" },
    update: {},
    create: { name: "Life Jackets" }
  });

  const products = [
    {
      name: "Life Jacket Pro",
      slug: "life-jacket-pro",
      description: "Coast-ready jacket",
      price: 1500,
      imageUrl: "https://images.unsplash.com/photo-1617957771973-15f2b76ea69a?q=80&w=1200&auto=format&fit=crop",
      stock: 50,
      categoryId: cat.id,
    },
    {
      name: "Kickboard",
      slug: "kickboard",
      description: "Training board",
      price: 500,
      imageUrl: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=1200&auto=format&fit=crop",
      stock: 100,
      categoryId: cat.id,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    });
  }
}
main().finally(()=>prisma.$disconnect());
