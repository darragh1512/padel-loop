"use client";

// The top of a full-screen conversation: back, who it's with, and its actions in
// a glass capsule. Messages scroll underneath it.

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ios/Icon";
import { lastPath } from "@/lib/navMemory";

export default function ChatHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode; // the actions
}) {
  const router = useRouter();
  return (
    <header className="ios-chat-head">
      <button
        type="button"
        className="ios-gcap-i ios-glass ios-press"
        aria-label="Back"
        onClick={() => {
          // Back to wherever they came from, such as the game's page. Someone
          // arriving from a link goes to their chats, staying inside the app.
          if (lastPath()) router.back();
          else router.push("/chat");
        }}
      >
        <Icon name="chevron-left" size={20} />
      </button>
      <div className="ios-grow" style={{ textAlign: "center" }}>
        <h1 className="ios-hl ios-clip">{title}</h1>
        <div className="ios-fn ios-sec ios-clip">{subtitle || " "}</div>
      </div>
      <div className="ios-gcap ios-glass">{children}</div>
    </header>
  );
}
