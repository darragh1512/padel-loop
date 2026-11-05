// A player's circle: their uploaded photo if they have one, otherwise their
// initials on solid grey.

import { initialsFrom } from "@/lib/data";

export default function Monogram({
  name,
  photoUrl,
  size = 40,
}: {
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
}) {
  const box = { width: size, height: size };
  if (photoUrl) {
    // A plain image: photos come from any uploaded size and are shown small.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className="ios-mono" style={{ ...box, objectFit: "cover" }} />;
  }
  return (
    <div className="ios-mono" aria-hidden style={{ ...box, fontSize: Math.round(size * 0.39) }}>
      {initialsFrom(name)}
    </div>
  );
}
