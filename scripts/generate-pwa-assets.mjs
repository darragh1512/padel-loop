// Generates the home-screen icon set and the iOS splash screens.
//
// Kept as a script rather than hand-made files so the whole set can be
// regenerated from one source when the mark changes — an icon set that has to
// be redrawn by hand in nine sizes is an icon set that goes stale.
//
// Run with:  node scripts/generate-pwa-assets.mjs
//
// Palette is the peña one, straight from globals.css.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const PISTA = "#1A4FC4";
const PISTA_D = "#0F1C3F";
const PAPEL = "#F4EEE0";
const TINTA = "#10214A";
const NARANJA = "#FF5A1F";
const LIMA = "#C6E63F";

/* The mark: the loop ring with its ball, on the court wall. Deliberately
   simple — a home-screen icon is read at 60px, where anything finer than two
   shapes turns to mush. `inset` shrinks the artwork for maskable icons, which
   Android crops to a circle. */
function markSvg(size, inset = 0) {
  const s = size;
  const c = s / 2;
  const scale = (1 - inset) * s;
  const r = scale * 0.3;
  const stroke = Math.max(2, scale * 0.075);
  const ballR = scale * 0.085;

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PISTA}"/>
      <stop offset="100%" stop-color="${PISTA_D}"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#wall)"/>
  <!-- painted court lines, the same device as the app's background -->
  <g stroke="${PAPEL}" stroke-opacity="0.14" stroke-width="${Math.max(1, s * 0.012)}" fill="none">
    <line x1="0" y1="${s * 0.26}" x2="${s}" y2="${s * 0.24}"/>
    <line x1="${s * 0.5}" y1="0" x2="${s * 0.51}" y2="${s}"/>
    <line x1="0" y1="${s * 0.76}" x2="${s}" y2="${s * 0.78}"/>
  </g>
  <!-- the loop -->
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${LIMA}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${r * 4.4} ${r * 1.5}"
          transform="rotate(-35 ${c} ${c})"/>
  <!-- the ball, closing it -->
  <circle cx="${c + r * 0.72}" cy="${c - r * 0.72}" r="${ballR}" fill="${NARANJA}"
          stroke="${TINTA}" stroke-width="${Math.max(1, stroke * 0.35)}"/>
</svg>`);
}

/* A splash screen is the MARK ONLY on the flat night-court colour — no
   gradient panel behind it, or the glyph reads as a pasted-on square. iOS
   shows this while the app boots, so the background must match the app’s own
   or the launch flashes white. */
function splashSvg(w, h) {
  const m = Math.round(Math.min(w, h) * 0.3);
  const cx = w / 2;
  const cy = h / 2;
  const r = m * 0.34;
  const stroke = m * 0.085;
  const ballR = m * 0.1;

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${PISTA_D}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${LIMA}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${r * 4.4} ${r * 1.5}"
          transform="rotate(-35 ${cx} ${cy})"/>
  <circle cx="${cx + r * 0.72}" cy="${cy - r * 0.72}" r="${ballR}" fill="${NARANJA}"
          stroke="${TINTA}" stroke-width="${stroke * 0.35}"/>
</svg>`);
}

// Home-screen and browser icons.
const ICONS = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  // Maskable: Android crops to a circle, so the mark is inset into the safe
  // zone rather than running to the edges.
  { file: "icon-maskable-512.png", size: 512, inset: 0.2 },
  // iOS. 180 is the one modern iPhones use; the others cover older devices
  // and iPad, which pick the nearest size and would otherwise downscale 512
  // and soften the mark.
  { file: "apple-touch-icon.png", size: 180 },
  { file: "apple-touch-icon-152.png", size: 152 },
  { file: "apple-touch-icon-167.png", size: 167 },
  { file: "apple-touch-icon-120.png", size: 120 },
  { file: "favicon-32.png", size: 32 },
  { file: "favicon-16.png", size: 16 },
];

// Device pixel sizes for the iPhones people actually hold. iOS matches these
// EXACTLY via media queries — a size that is off by a pixel simply does not
// show, and you get a white flash instead.
const SPLASHES = [
  { w: 750, h: 1334, label: "iPhone SE / 6-8" },
  { w: 1242, h: 2208, label: "iPhone 8 Plus" },
  { w: 1125, h: 2436, label: "iPhone X / XS / 11 Pro" },
  { w: 828, h: 1792, label: "iPhone XR / 11" },
  { w: 1242, h: 2688, label: "iPhone XS Max / 11 Pro Max" },
  { w: 1170, h: 2532, label: "iPhone 12 / 13 / 14" },
  { w: 1284, h: 2778, label: "iPhone 12/13 Pro Max / 14 Plus" },
  { w: 1179, h: 2556, label: "iPhone 14 Pro / 15 / 16" },
  { w: 1290, h: 2796, label: "iPhone 14 Pro Max / 15 Pro Max" },
  { w: 1206, h: 2622, label: "iPhone 16" },
];

await mkdir("public/icons", { recursive: true });
await mkdir("public/splash", { recursive: true });

for (const { file, size, inset = 0 } of ICONS) {
  await sharp(markSvg(size, inset)).png().toFile(`public/icons/${file}`);
  console.log("icon  ", file.padEnd(28), `${size}×${size}`);
}

for (const { w, h, label } of SPLASHES) {
  const file = `splash-${w}x${h}.png`;
  await sharp(splashSvg(w, h)).png().toFile(`public/splash/${file}`);
  console.log("splash", file.padEnd(28), label);
}

console.log(`\n${ICONS.length} icons, ${SPLASHES.length} splash screens.`);
