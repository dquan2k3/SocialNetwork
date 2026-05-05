import type { NextConfig } from "next";

/**
 * Chỉ dùng biến server/build (không dùng NEXT_PUBLIC_* làm đích proxy).
 * Trên Vercel: BACKEND_URL=https://social-network-7h71.onrender.com
 */
const BACKEND_URL = process.env.BACKEND_URL?.trim()?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    if (!BACKEND_URL) return [];
    return [
      {
        source: "/express-api/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
