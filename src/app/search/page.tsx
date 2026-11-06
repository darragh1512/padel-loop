// Find Players (/search): search everyone on Padel Loop by name.

import BottomNav from "@/components/BottomNav";
import PageTitle from "@/components/ios/PageTitle";
import PlayerSearch from "@/components/PlayerSearch";

export default function SearchPage() {
  return (
    <main className="ios">
      <PageTitle title="Find Players" fallback="/discover" />
      <PlayerSearch autoFocus>
        <p className="ios-sh ios-sec" style={{ textAlign: "center", padding: "24px 32px 0" }}>
          Start typing a name to find players.
        </p>
      </PlayerSearch>
      <div style={{ height: 16 }} />
      <BottomNav />
    </main>
  );
}
