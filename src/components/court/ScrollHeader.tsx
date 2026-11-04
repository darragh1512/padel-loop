"use client";

// A glass title bar that appears once the page's own big title has scrolled
// away. It repeats the title, so screen readers skip it.

import { useEffect, useRef, useState } from "react";
import { GlassSurface } from "@/components/glassyui/glass-surface";

export default function ScrollHeader({ title }: { title: string }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShown(!entry.isIntersecting),
      { rootMargin: "48px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="absolute top-0 h-px w-px" />
      <div
        aria-hidden
        className={`fixed top-0 inset-x-0 z-20 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pointer-events-none transition-opacity duration-150 ease-out ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      >
        <GlassSurface className="c-glass mx-auto w-fit max-w-full rounded-full px-5 py-2">
          <span className="c-title block truncate text-[0.9375rem] text-c-ink">{title}</span>
        </GlassSurface>
      </div>
    </>
  );
}
