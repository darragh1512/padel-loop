import BottomNav from "@/components/BottomNav";
import { Skeleton } from "@/components/ui";

// Route-level skeleton for Discover: mirrors the real layout — title, search
// pill, chip row, then game cards — so the page reads as itself while the
// fresh games list loads. Never a spinner.
export default function DiscoverLoading() {
  return (
    <main className="px-5 pt-6 relative">
      <p className="t-mono text-micro text-papel/80 mt-2">The board · Dublin</p>
      <h1 className="t-display text-display-md text-papel mt-1.5">
        Disc<span className="text-lima">o</span>ver
      </h1>
      <p className="text-label font-medium text-papel/85 mt-1.5">
        Open games near you — pick a poster and jump in.
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
