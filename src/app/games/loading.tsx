import BottomNav from "@/components/BottomNav";
import { Skeleton } from "@/components/ui";

// Route-level skeleton for /games — the shape of the page, never a spinner, so
// nothing jumps when the real list lands.
export default function GamesLoading() {
  return (
    <main className="px-5 pt-6 relative">
      <h1 className="t-display text-display-md text-papel mt-2 relative">
        All games
      </h1>
      <Skeleton className="rounded-field h-4 w-40 mt-2.5" />

      <div className="flex gap-2 mt-5">
        <Skeleton className="rounded-pill h-8 w-20" />
        <Skeleton className="rounded-pill h-8 w-20" />
        <Skeleton className="rounded-pill h-8 w-20" />
      </div>

      <div className="mt-9 space-y-3">
        <Skeleton className="rounded-card h-28" />
        <Skeleton className="rounded-card h-28" />
        <Skeleton className="rounded-card h-28" />
      </div>

      <BottomNav />
    </main>
  );
}
