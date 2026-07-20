"use client";

import BottomNav from "@/components/BottomNav";
import CreateGameForm from "@/components/CreateGameForm";

export default function CreateGamePage() {
  return (
    <main className="px-5 pt-6 relative">
      <CreateGameForm />
      <BottomNav />
    </main>
  );
}
