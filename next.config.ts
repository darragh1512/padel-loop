import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

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

// Sentry's build step. Its only job here is SOURCE MAPS: without them a
// production stack trace is minified rubbish like `a.b is not a function` at
// `page-4f2c.js:1:20481`, which tells you nothing.
//
// The maps are uploaded to Sentry and then DELETED from the deployed output
// (widenClientFileUpload + hideSourceMaps), so they are readable in the issue
// view without being downloadable from the public site — a source map on a
// public URL hands anyone your unminified source.
//
// Uploading needs SENTRY_AUTH_TOKEN at build time. Without it the build still
// succeeds; you just get unreadable traces, which is why the token belongs in
// the Vercel environment, not only on your laptop.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Quiet unless something is wrong.
  silent: true,

  // Upload maps for the whole client bundle, not just page chunks.
  widenClientFileUpload: true,

  // Strip the maps from the build output after upload.
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Routes Sentry's own browser requests through this app's domain, so an ad
  // blocker doesn't silently swallow error reports.
  tunnelRoute: "/monitoring",

});
