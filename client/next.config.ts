import type { NextConfig } from "next";

/** Proxied to Express so Set-Cookie uses the frontend host (Vercel), not the API host (Render). */
const BACKEND_URL = process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, "");

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
