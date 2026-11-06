import BottomNav from "@/components/BottomNav";

// Discover's own shape while its games load, so nothing jumps when they land.
export default function DiscoverLoading() {
  return (
    <main className="ios" aria-busy="true">
      <header className="ios-nav">
        <h1 className="ios-lt">Discover</h1>
      </header>
      <div aria-hidden>
        <div className="ios-skel" style={{ height: 40, borderRadius: 20, margin: "8px 16px 0" }} />
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 0" }}>
          <div className="ios-skel" style={{ width: 88, height: 36, borderRadius: 18 }} />
          <div className="ios-skel" style={{ width: 88, height: 36, borderRadius: 18 }} />
          <div className="ios-skel" style={{ width: 88, height: 36, borderRadius: 18 }} />
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="ios-skel" style={{ height: 150, margin: "0 16px 10px" }} />
          <div className="ios-skel" style={{ height: 150, margin: "0 16px 10px" }} />
          <div className="ios-skel" style={{ height: 150, margin: "0 16px 10px" }} />
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
