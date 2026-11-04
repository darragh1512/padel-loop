import BottomNav from "@/components/BottomNav";
import { Skeleton } from "@/components/ui";

// Route-level skeleton for Discover: mirrors the real layout — title, search
// pill, chip row, then game cards — so the page reads as itself while the
// fresh games list loads. Never a spinner.
export default function DiscoverLoading() {
  return (
    <main className="court court-page px-4 pt-6 relative">
      <h1 className="c-title text-[2.125rem] leading-tight mt-2">Discover</h1>
      <p className="text-[0.9375rem] text-c-sub mt-0.5">Open games near you in Dublin.</p>

      <Skeleton className="rounded-full h-11 mt-4" />
      <div className="flex gap-2 mt-3">
        <Skeleton className="rounded-full h-9 w-20" />
        <Skeleton className="rounded-full h-9 w-20" />
        <Skeleton className="rounded-full h-9 w-20" />
      </div>

      <div className="mt-7 space-y-3">
        <Skeleton className="rounded-card h-34" />
        <Skeleton className="rounded-card h-34" />
        <Skeleton className="rounded-card h-34" />
      </div>

      <BottomNav />
    </main>
  );
}
