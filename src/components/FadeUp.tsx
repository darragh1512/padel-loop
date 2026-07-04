"use client";

// Gentle fade-up-on-scroll wrapper for landing-page sections: the child starts
// transparent and 12px lower, then eases into place the first time it scrolls
// into view (400ms ease-out, once — no looping, no parallax).
//
// Respects prefers-reduced-motion: when the visitor asks for less motion the
// content simply renders in place with no animation at all.

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function FadeUp({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Reduced motion: skip straight to the visible state.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect(); // once only
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(8px)",
        transition:
          "opacity 300ms var(--ease-out-strong), transform 300ms var(--ease-out-strong)",
      }}
    >
      {children}
    </div>
  );
}
