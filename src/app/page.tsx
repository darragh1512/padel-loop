import BottomNav from "@/components/BottomNav";
import HomeDashboard from "@/components/HomeDashboard";
import NotificationBell from "@/components/NotificationBell";
import { LevelChip } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="px-5 pt-6 relative">
      <div className="flex justify-between items-center relative">
        <div className="flex items-center gap-1.5 text-[13px] text-ink-secondary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-ink-faint">
            <path d="M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11Z" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="10" r="2.5" fill="currentColor" />
          </svg>
          Malahide, Dublin
        </div>
        <div className="flex items-center gap-3.5">
          <NotificationBell />
          <LevelChip>Level 3.2</LevelChip>
        </div>
      </div>

      {/* Dashboard: the next-game hero plus "Find a game" (primary action) and
          "Connections" cards. The joinable-games list lives on /discover. */}
      <HomeDashboard />

      <BottomNav />
    </main>
  );
}
