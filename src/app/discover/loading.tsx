import BottomNav from "@/components/BottomNav";
import { Skeleton } from "@/components/ui";

// Route-level skeleton for Discover: mirrors the real layout — title, search
// pill, chip row, then game cards — so the page reads as itself while the
// fresh games list loads. Never a spinner.
export default function DiscoverLoading() {
  return (
    <main className="px-5 pt-6 relative">
      <h1 className="font-display text-display-md text-ink mt-2">Discover</h1>
      <p className="text-label text-ink-secondary mt-1">
        Open games near you — find one and jump in.
      </p>

      <Skeleton className="rounded-pill h-11 mt-4" />
      <div className="flex gap-2 mt-3">
        <Skeleton className="rounded-pill h-8 w-20" />
        <Skeleton className="rounded-pill h-8 w-20" />
        <Skeleton className="rounded-pill h-8 w-20" />
        <Skeleton className="rounded-pill h-8 w-32" />
      </div>

      <div className="mt-11 space-y-3">
        <Skeleton className="rounded-card h-28" />
        <Skeleton className="rounded-card h-28" />
        <Skeleton className="rounded-card h-28" />
      </div>

      <BottomNav />
    </main>
  );
}
