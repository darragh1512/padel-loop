"use client";
// A reusable "find and pick people" panel — the same name search as Discover,
// but a tap calls onPick instead of opening a profile. Used by New Group (choose
// several before creating) and a group's Add Members (each added immediately).

import { useState } from "react";
import Icon from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import { usePlayerSearch } from "@/lib/usePlayerSearch";
import type { ProfileSearchResult } from "@/app/profiles";

export default function MemberPicker({
  excludeIds = [],
  onPick,
}: {
  // ids to leave out of results — already-picked people, or existing members.
  excludeIds?: string[];
  onPick: (person: ProfileSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const { results, searching, searched, failed, retry } = usePlayerSearch(query);
  const visible = results.filter((p) => !excludeIds.includes(p.id));
  const term = query.trim();

  return (
    <>
      <div className="ios-search" role="search">
        <Icon name="search" size={20} />
        <input
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          aria-label="Search players by name"
        />
        {query && (
          <button type="button" className="ios-search-btn" aria-label="Clear search" onClick={() => setQuery("")}>
            <Icon name="clear" size={18} />
          </button>
        )}
      </div>

      {term !== "" && (
        <div style={{ marginTop: 12 }}>
          {searching ? (
            <div className="ios-skel" aria-hidden style={{ height: 56, margin: "0 16px" }} />
          ) : failed ? (
            <div className="ios-card ios-sh" style={{ padding: 16 }} role="alert">
              Couldn’t search players.{" "}
              <button
                type="button"
                className="ios-acc ios-md"
                style={{ border: 0, padding: 0, background: "none", cursor: "pointer", font: "inherit" }}
                onClick={retry}
              >
                Try Again
              </button>
            </div>
          ) : visible.length > 0 ? (
            <div className="ios-list">
              {visible.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="ios-row ios-toggle-row"
                  style={{ padding: "8px 16px", "--ios-inset": "68px" } as React.CSSProperties}
                  aria-label={`Add ${person.name || "player"}`}
                  onClick={() => onPick(person)}
                >
                  <Monogram name={person.name} photoUrl={person.avatar_url} />
                  <span className="ios-bd ios-grow ios-clip">{person.name || "Player"}</span>
                  <span className="ios-acc">
                    <Icon name="plus" size={18} />
                  </span>
                </button>
              ))}
            </div>
          ) : searched ? (
            <div className="ios-sh ios-sec" style={{ textAlign: "center", padding: 12 }}>
              No players found for “{term}”.
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
