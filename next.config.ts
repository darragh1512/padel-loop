import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root to this folder so Next.js doesn't get confused
  // by a leftover lockfile in a parent directory.
  turbopack: {
    root: __dirname,
  },
  // Hide the floating Next.js dev-tools badge during local development —
  // it has no effect on the deployed site (and keeps screenshots clean).
  devIndicators: false,
};

export default nextConfig;
