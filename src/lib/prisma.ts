import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

// Workers can't reuse a socket across requests, so each request gets its own
// client (keyed on its ExecutionContext). Node (Vercel, dev) keeps one global client.
const perRequest = new WeakMap<object, PrismaClient>();
function workersClient(): PrismaClient {
  const { ctx } = getCloudflareContext();
  let client = perRequest.get(ctx);
  if (!client) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // Workers closes the sockets when the request ends; idle clients then error. Expected.
    pool.on("error", () => {});
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    perRequest.set(ctx, client);
  }
  return client;
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient = onWorkers
  ? new Proxy({} as PrismaClient, {
      get(_, prop) {
        const client = workersClient();
        const value = Reflect.get(client, prop);
        return typeof value === "function" ? value.bind(client) : value;
      },
    })
  : (globalForPrisma.prisma ??= new PrismaClient());
