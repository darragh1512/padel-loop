"use client";

// The player self-rating control: one row per skill level, each with a
// plain-English line for what that level actually plays like — not just a name.
// Used when signing up and on the welcome screen, so a player's sense of their
// own level stays the same wherever they first set it.

import Icon from "@/components/ios/Icon";
import { SKILL_LEVELS, SKILL_LEVEL_DESCRIPTIONS } from "@/app/profiles";

export default function SkillLevelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (level: string) => void;
}) {
  return (
    <div className="ios-list" role="radiogroup" aria-label="Your level">
      {SKILL_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={value === level}
          className="ios-row ios-toggle-row"
          style={{ padding: "9px 16px" }}
          onClick={() => onChange(level)}
        >
          <span className="ios-grow">
            <span className="ios-bd" style={{ display: "block" }}>
              {level}
            </span>
            <span className="ios-fn ios-sec" style={{ display: "block" }}>
              {SKILL_LEVEL_DESCRIPTIONS[level]}
            </span>
          </span>
          <span className="ios-acc" style={{ width: 18, flex: "none" }}>
            {value === level && <Icon name="check" size={18} />}
          </span>
        </button>
      ))}
    </div>
  );
}
