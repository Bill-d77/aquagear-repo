// OpenNext's generated worker plus a cron handler. Workers cron triggers call
// scheduled(), not a URL, so forward them to the same route Vercel Cron hits.
import handler from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,
  async scheduled(_event, env, ctx) {
    const req = new Request("https://cron.internal/api/cron/meta", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
};

// Re-export OpenNext's Durable Objects so wrangler can bind them if configured.
export * from "./.open-next/worker.js";
