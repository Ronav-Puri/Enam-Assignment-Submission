import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser talks only to our own domain (/sb/...), and Vercel forwards to Supabase.
  // This keeps the app working on networks that block *.supabase.co.
  async rewrites() {
    return [{ source: "/sb/:path*", destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/:path*` }];
  },
};

export default nextConfig;