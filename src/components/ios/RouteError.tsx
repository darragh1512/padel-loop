"use client";

// A page that couldn't load, most likely a database read that didn't come back. It
// says loading failed and never that there's nothing there, because that isn't known.

import { useEffect, type ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import MessageCard, { TryAgain } from "@/components/ios/MessageCard";

export default function RouteError({
  error,
  retry,
  head,
  title,
  body,
}: {
  error: Error;
  retry: () => void;
  head: ReactNode;
  title: string;
  body: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="ios">
      {head}
      <MessageCard alert title={title} body={body} action={<TryAgain onClick={retry} />} />
      <BottomNav />
    </main>
  );
}
