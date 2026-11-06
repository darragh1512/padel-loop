"use client";

// A player's profile as a scannable code. Always black on white, in dark mode too,
// because that's what phone cameras read most reliably.

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
      color: { dark: "#000000ff", light: "#ffffffff" },
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className={ready ? "" : "invisible"}
        />
        {!ready && !failed && (
          <div aria-hidden className="ios-skel" style={{ position: "absolute", inset: 0, borderRadius: 12 }} />
        )}
      </div>
      {failed ? (
        <p className="ios-fn ios-destructive" style={{ marginTop: 10 }} role="alert">
          Couldn’t make a code. Try again.
        </p>
      ) : null}
    </div>
  );
}
