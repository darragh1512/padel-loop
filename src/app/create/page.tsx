"use client";

import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import CreateSheet from "@/components/court/CreateSheet";

// A direct /create link opens the same sheet, already up. Closing it goes back
// where they came from, or home if this was the first page they opened.
export default function CreateGamePage() {
  const router = useRouter();
  return (
    <main className="court court-page min-h-dvh relative">
      <CreateSheet
        open
        onOpenChange={() => {
          if (window.history.length > 1) router.back();
          else router.push("/");
        }}
      />
      <BottomNav />
    </main>
  );
}
