"use client";

// A camera scanner for another player's QR code. Opens the device camera,
// samples frames onto a hidden canvas, and decodes them with jsQR (pure JS,
// no native deps). Calls onScan once with the raw text it finds — the caller
// decides what a valid code looks like and what to do with it.

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Spinner } from "@/components/ui";

type Status = "starting" | "scanning" | "denied" | "unsupported";

export default function QRScanner({
  onScan,
}: {
  onScan: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const scannedRef = useRef(false);
  // Kept in a ref (not a dependency) so a caller passing a fresh onScan
  // closure on every render doesn't restart the camera.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const [status, setStatus] = useState<Status>("starting");

  useEffect(() => {
    let cancelled = false;
    scannedRef.current = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || scannedRef.current) return;

      if (video.readyState >= video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (code && code.data) {
            scannedRef.current = true;
            onScanRef.current(code.data);
            return;
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setStatus("scanning");
        tick();
      } catch {
        if (!cancelled) setStatus("denied");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <div className="pl-card pena-staples pena-tilt-b p-4 flex flex-col items-center text-center">
      <div className="relative w-full aspect-square max-w-[280px] rounded-field overflow-hidden bg-tinta">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${status === "scanning" ? "" : "opacity-0"}`}
        />
        {status !== "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center px-5">
            {status === "starting" && <Spinner className="text-papel" />}
            {status === "denied" && (
              <p className="text-label font-medium text-papel">
                Camera access is off. Allow it in your browser settings to scan a code.
              </p>
            )}
            {status === "unsupported" && (
              <p className="text-label font-medium text-papel">
                Scanning isn&rsquo;t supported in this browser.
              </p>
            )}
          </div>
        )}
        {status === "scanning" && (
          <div aria-hidden className="absolute inset-6 rounded-field border-2 border-lima" />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="t-mono text-[9px] tracking-[0.1em] text-tinta/70 mt-3">
        Point your camera at a player&rsquo;s code
      </p>
    </div>
  );
}
