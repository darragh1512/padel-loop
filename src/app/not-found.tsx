// A link to something that doesn't exist, most often a game that's been deleted
// since the link was shared in a group chat.

import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import MessageCard from "@/components/ios/MessageCard";

export default function NotFound() {
  return (
    <main className="ios">
      <header className="ios-nav">
        <h1 className="ios-lt">Not Found</h1>
      </header>
      <MessageCard
        title="This Page Isn’t Here"
        body="If someone shared this link, the game may no longer be listed."
        action={
          <Link href="/discover" className="ios-pill ios-press">
            Find a Game
          </Link>
        }
      />
      <BottomNav />
    </main>
  );
}
