import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // app/global-not-found.tsx: the 404 for addresses no route matches (the
    // root layout sits under the dynamic [locale] segment)
    globalNotFound: true,
  },
};

export default nextConfig;
