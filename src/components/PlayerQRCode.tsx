"use client";

// A player's profile as a scannable code — printed straight onto a poster
// scrap so it reads as part of the peña, not a bolted-on utility widget. The
// QR itself is drawn with tinta ink on a transparent field so the card's own
// paper grain shows through the light modules, like it was actually printed.

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

const SIZE = 208;

export default function PlayerQRCode({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    setReady(false);
    setFailed(false);

    QRCode.toCanvas(canvas, url, {
      width: SIZE,
      margin: 1,
      color: { dark: "#191407ff", light: "#f3e9d200" },
    })
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div className="pl-card pena-staples pena-tilt-a p-5 pt-7 flex flex-col items-center text-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className={ready ? "" : "invisible"}
        />
        {!ready && !failed && (
          <div aria-hidden className="absolute inset-0 rounded-field pl-skeleton" />
        )}
      </div>
      {failed ? (
        <p className="text-label font-medium text-naranja-d mt-3">
          Couldn&rsquo;t generate a code. Please try again.
        </p>
      ) : (
        <p className="t-mono text-[9px] tracking-[0.1em] text-tinta/70 mt-3">
          Scan to view this profile
        </p>
      )}
    </div>
  );
}
