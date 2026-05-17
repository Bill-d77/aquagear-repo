import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME || "Admin";

  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set before running seed");
  }

  const pass = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, role: "ADMIN" },
    create: { name: adminName, email: adminEmail, password: pass, role: "ADMIN" }
  });

  const categoryNames = [
    "Life Jackets",
    "Kickboards",
    "Fenders",
    "Floating Wheels",
    "Flamingos",
    "Shaped Small Boats",
    "Water Tanks",
    "Pools",
    "Boats",
    "Floating Chairs",
  ];

  const catRecords = {};
  for (const name of categoryNames) {
    const c = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    catRecords[name] = c;
  }

  // Helper to slugify
  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const sampleProducts = categoryNames.map((name) => ({
    name: `${name} Starter`,
    slug: slugify(`${name} Starter`),
    description: `High-quality ${name.toLowerCase()} for sea activities.`,
    price: 1500,
    imageUrl: "https://images.unsplash.com/photo-1520971383572-9d5d42baacb6?q=80&w=1200&auto=format&fit=crop",
    stock: 50,
    categoryId: catRecords[name].id,
  }));

  for (const p of sampleProducts) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    });
  }
}
main().finally(()=>prisma.$disconnect());
