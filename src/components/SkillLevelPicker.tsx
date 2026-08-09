"use client";

// The player self-rating control: a stack of tappable cards, one per skill
// level, each with a plain-English line for what that level actually plays
// like — not just a name. Shared by onboarding (signup) and the profile edit
// forms, so a player's sense of their own level stays the same wherever they
// set it.

import { SKILL_LEVELS, SKILL_LEVEL_DESCRIPTIONS } from "@/app/profiles";

export default function SkillLevelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (level: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Skill level" className="flex flex-col gap-2">
      {SKILL_LEVELS.map((level) => {
        const active = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(level)}
            className={`pl-press text-left rounded-field border-2 px-4 py-3 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima ${
              active
                ? "bg-lima border-tinta"
                : "bg-papel border-tinta/20 hover:border-tinta/50"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="t-mono text-micro tracking-[0.12em] text-tinta font-extrabold">
                {level}
              </span>
              <span
                aria-hidden
                className={`shrink-0 size-4.5 rounded-pill border-2 border-tinta flex items-center justify-center ${
                  active ? "bg-tinta" : "bg-papel"
                }`}
              >
                {active && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="text-papel">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </div>
            <p className="text-label font-medium text-tinta/70 mt-1">
              {SKILL_LEVEL_DESCRIPTIONS[level]}
            </p>
          </button>
        );
      })}
    </div>
  );
}
