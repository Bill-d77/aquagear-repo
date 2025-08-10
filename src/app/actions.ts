"use server";
import { neon } from "@neondatabase/serverless";

export async function getData() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const sql = neon(databaseUrl);
  // Example query: fetch product count
  const rows = await sql`SELECT COUNT(*)::int AS count FROM "Product"`;
  return rows;
} 