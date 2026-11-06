// One player in a list: their circle, name and level, linking to their profile.

import Link from "next/link";
import Icon from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";

export default function PlayerRow({
  person,
}: {
  person: {
    id: string;
    name: string | null;
    skill_level: string | null;
    home_club: string | null;
    avatar_url: string | null;
  };
}) {
  return (
    <Link
      href={`/players/${person.id}`}
      className="ios-row ios-link"
      style={{ padding: "8px 16px", "--ios-inset": "68px" } as React.CSSProperties}
    >
      <Monogram name={person.name} photoUrl={person.avatar_url} />
      <div className="ios-grow">
        <div className="ios-bd ios-clip">{person.name || "Player"}</div>
        <div className="ios-fn ios-sec ios-clip">{[person.skill_level, person.home_club].filter(Boolean).join(" · ")}</div>
      </div>
      <span className="ios-chev">
        <Icon name="chevron-right" size={13} />
      </span>
    </Link>
  );
}
