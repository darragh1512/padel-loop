// The "Find players" screen (/search): a text box that searches the profiles
// table by display name and lists the people it finds, each linking to their
// profile (/players/[id]). The search box + results are the shared
// PlayerSearch widget (also embedded on /discover and /connections).

import BottomNav from "@/components/BottomNav";
import PlayerSearch from "@/components/PlayerSearch";

export default function SearchPage() {
  return (
    <main className="px-5 pt-6 relative">
      <h1 className="t-display text-display-md text-papel mt-2 relative">
        Find players
      </h1>
      <p className="text-label font-medium text-papel/85 mt-1.5 mb-4">
        Search for people by name.
      </p>

      <PlayerSearch autoFocus emptyHint="Start typing a name to find players." />

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
