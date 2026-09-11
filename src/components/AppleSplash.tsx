// iOS splash screens.
//
// Next has no metadata API for these, so the <link> tags are emitted by hand.
// iOS matches each one by an EXACT media query on device width, height and
// pixel ratio — a size that is off by a single pixel simply does not match,
// and the app launches to a white flash instead. The list mirrors
// scripts/generate-pwa-assets.mjs; regenerate both together.

const SPLASHES = [
  { w: 750, h: 1334, ratio: 2 }, // SE / 6-8
  { w: 1242, h: 2208, ratio: 3 }, // 8 Plus
  { w: 1125, h: 2436, ratio: 3 }, // X / XS / 11 Pro
  { w: 828, h: 1792, ratio: 2 }, // XR / 11
  { w: 1242, h: 2688, ratio: 3 }, // XS Max / 11 Pro Max
  { w: 1170, h: 2532, ratio: 3 }, // 12 / 13 / 14
  { w: 1284, h: 2778, ratio: 3 }, // 12-13 Pro Max / 14 Plus
  { w: 1179, h: 2556, ratio: 3 }, // 14 Pro / 15 / 16
  { w: 1290, h: 2796, ratio: 3 }, // 14 Pro Max / 15 Pro Max
  { w: 1206, h: 2622, ratio: 3 }, // 16
];

export default function AppleSplash() {
  return (
    <>
      {SPLASHES.map(({ w, h, ratio }) => (
        <link
          key={`${w}x${h}`}
          rel="apple-touch-startup-image"
          href={`/splash/splash-${w}x${h}.png`}
          media={`(device-width: ${w / ratio}px) and (device-height: ${h / ratio}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`}
        />
      ))}
    </>
  );
}
