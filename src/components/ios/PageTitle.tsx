"use client";

// The top of a screen you reach from another one: a back button and a large title.

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ios/Icon";
import { previousPath } from "@/lib/navMemory";

export default function PageTitle({
  title,
  fallback = "/",
  right,
}: {
  title: string;
  fallback?: string; // where Back goes for someone who arrived from a link
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <>
      <div className="ios-profile-tools">
        <button
          type="button"
          className="ios-gcap-i ios-glass ios-press"
          aria-label="Back"
          onClick={() => {
            if (previousPath()) router.back();
            else router.push(fallback);
          }}
        >
          <Icon name="chevron-left" size={20} />
        </button>
        {right}
      </div>
      <h1 className="ios-lt" style={{ padding: "calc(var(--ios-top-gap) + 52px) 20px 0" }}>
        {title}
      </h1>
    </>
  );
}
