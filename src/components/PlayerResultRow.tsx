// One player row: avatar + name + club/skill, linking to their profile. The
// shared row shape for anywhere a list of players links out to /players/[id]
// (search results, connections list) — same markup, just handed a different
// person shape.

import Link from "next/link";
import PlayerAvatar from "@/components/PlayerAvatar";

export type PlayerResultPerson = {
  id: string;
  name: string | null;
  skill_level: string | null;
  home_club: string | null;
  avatar_url: string | null;
};

export default function PlayerResultRow({
  person,
  delay = 0,
}: {
  person: PlayerResultPerson;
  delay?: number;
}) {
  const name = person.name || "Player";
  return (
    <Link
      href={`/players/${person.id}`}
      className="flex items-center gap-3.5 pl-card p-4 mb-3 pl-rise active:scale-[0.99] transition-transform duration-150 ease-out"
      style={{ animationDelay: `${delay}ms` }}
    >
      <PlayerAvatar
        userId={person.id}
        avatarUrl={person.avatar_url}
        name={name}
        className="size-11"
      />
      <div className="min-w-0 flex-1">
        <div className="font-extrabold text-body text-tinta truncate">{name}</div>
        <div className="t-mono text-[9px] tracking-[0.1em] text-tinta/70 truncate mt-1">
          {person.home_club || "No home club"}
          {person.skill_level ? <> · {person.skill_level}</> : null}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-tinta/45">
        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
