import BottomNav from "@/components/BottomNav";
import { MiniLoop } from "@/components/brand";

// A minimal placeholder so the bottom-nav Chat icon has a real destination
// (no 404). Styled in the app's design language.
export default function ChatPage() {
  return (
    <main className="px-5 pt-6 relative">
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      <h1 className="font-display text-xl tracking-tight mt-2 relative">
        <b className="font-bold">Chat</b>
      </h1>
      <p className="text-[13px] text-dim font-light mt-1 mb-4">
        Talk to the players in your games.
      </p>

      <div className="pl-card p-6 mt-6 flex flex-col items-center text-center gap-3">
        <MiniLoop size={40} />
        <div className="text-[15px] font-semibold">Chat is coming soon</div>
        <div className="text-[12.5px] text-faint font-light">
          Once you join a game, this is where you&apos;ll sort out who&apos;s
          bringing the balls.
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
