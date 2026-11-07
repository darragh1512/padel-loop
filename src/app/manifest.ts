import type { MetadataRoute } from "next";

// The web app manifest — what iOS and Android read when somebody adds the app
// to their home screen. Next serves this at /manifest.webmanifest and links it
// from every page automatically.
//
// The background is the app's own light background, so the launch and the first
// paint are the same colour.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Padel Loop",
    short_name: "Padel Loop", // fits under a home-screen icon
    description: "Find and join a padel game near you, at your level.",

    start_url: "/",
    // No browser chrome. This is the setting that makes the back button
    // disappear — see the standalone notes in README-PWA.md.
    display: "standalone",
    orientation: "portrait",

    background_color: "#F2F2F7",
    theme_color: "#F2F2F7", // the iOS status bar / Android title bar

    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops icons to a circle; the maskable one has its artwork
      // inset into the safe zone so nothing important is cut off.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
