import BottomNav from "@/components/BottomNav";
import HomeDashboard from "@/components/HomeDashboard";

export default function HomePage() {
  return (
    <main className="px-5 pt-3 relative">
      {/* Home = the dashboard: greeting + bell, the next-game hero, and the
          screen's one primary action, Find a game. The joinable-games list
          lives on /discover. */}
      <HomeDashboard />
      <BottomNav />
    </main>
  );
}
