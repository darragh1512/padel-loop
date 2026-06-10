import BottomNav from "@/components/BottomNav";
import GameCard from "@/components/GameCard";
import { Chip, LevelChip, SectionLabel } from "@/components/ui";
import { getGames } from "@/lib/data";

export const revalidate = 60;

export default async function HomePage() {
  const games = await getGames();

  return (
    <main className="px-5 pt-6 relative">
      {/* ambient glow */}
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      <div className="flex justify-between items-center relative">
        <div className="flex items-center gap-1.5 text-[11px] tracking-[1.5px] uppercase text-faint">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11Z" stroke="#3a5a9a" strokeWidth="2" />
            <circle cx="12" cy="10" r="2.5" fill="#3a5a9a" />
          </svg>
          Malahide, Dublin
        </div>
        <LevelChip>LVL 3.2</LevelChip>
      </div>

      <h1 className="font-display text-[21px] tracking-tight leading-snug mt-3.5 relative">
        <b className="font-bold">Evening, Darragh.</b>
        <br />
        <span className="font-light text-sky">
          {games.length} game{games.length === 1 ? "" : "s"} near you tonight.
        </span>
      </h1>

      <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar relative">
        <Chip active>Tonight</Chip>
        <Chip>Level 3–4</Chip>
        <Chip>&lt; 5 km</Chip>
        <Chip>Any price</Chip>
      </div>

      <SectionLabel>Games near you</SectionLabel>

      {games.map((g, i) => (
        <GameCard key={g.id} game={g} delay={i * 80} />
      ))}

      <BottomNav />
    </main>
  );
}
