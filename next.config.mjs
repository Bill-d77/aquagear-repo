/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "www.tobitengineers.com",
      },
      {
        protocol: "https",
        hostname: "tobitengineers.com",
      },
    ],
  },
};

export default nextConfig;
