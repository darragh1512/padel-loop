import BottomNav from "@/components/BottomNav";

// A profile's shape, shown the moment Profile (or any player) is tapped, while
// the server prepares the page. Without it the tap seemed to do nothing for half
// a second. Same shape as the page's own placeholder, so nothing jumps.
export default function PlayerLoading() {
  return (
    <main className="ios" aria-busy="true">
      <div aria-hidden style={{ paddingTop: "calc(var(--ios-top-gap) + 30px)" }}>
        <div className="ios-skel" style={{ width: 84, height: 84, borderRadius: "50%", margin: "0 auto" }} />
        <div className="ios-skel" style={{ height: 76, margin: "60px 16px 0" }} />
        <div className="ios-skel" style={{ height: 180, margin: "18px 16px 0" }} />
      </div>
      <BottomNav />
    </main>
  );
}
