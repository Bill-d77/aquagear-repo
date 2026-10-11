/** @type {import('next').NextConfig} */
const nextConfig = {
  // OpenNext swaps in the Workers (wasm) Prisma engine; it must stay unbundled.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // pg loads pg-cloudflare via a "workerd" export that Node tracing skips.
  outputFileTracingIncludes: { "/*": ["./node_modules/pg-cloudflare/**/*"] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // ponytail: no full CSP yet — needs nonce plumbing for Next inline scripts.
          // frame-ancestors alone delivers the main CSP win here (clickjacking).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
      },
    ],
  },
};

export default nextConfig;
