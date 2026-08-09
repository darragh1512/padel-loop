"use client";

import BottomNav from "@/components/BottomNav";
import CreateGameForm from "@/components/CreateGameForm";

export default function CreateGamePage() {
  return (
    /* Extra bottom padding clears the pinned create bar as well as the nav. */
    <main className="px-5 pt-4 pb-32 relative">
      <CreateGameForm />
      <BottomNav />
    </main>
  );
}
