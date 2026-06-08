import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root to this folder so Next.js doesn't get confused
  // by a leftover lockfile in a parent directory.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
