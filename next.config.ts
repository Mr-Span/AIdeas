import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactStrictMode: true,
  outputFileTracingExcludes: {
    "/*": ["./next.config.ts"],
  },
};

export default nextConfig;
