"use client";

// A player-name search box with live results underneath, each linking to that
// player's profile. Whatever is passed as children shows until someone types.

import { useState, type ReactNode } from "react";
import Icon from "@/components/ios/Icon";
import MessageCard, { TryAgain } from "@/components/ios/MessageCard";
import PlayerRow from "@/components/ios/PlayerRow";
import { usePlayerSearch } from "@/lib/usePlayerSearch";

export default function PlayerSearch({
  placeholder = "Search by name",
  autoFocus = false,
  children,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const { results, searching, searched, failed, retry } = usePlayerSearch(query);
  const term = query.trim();

  return (
    <>
      <div className="ios-search" role="search">
        <Icon name="search" size={20} />
        <input
          type="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search players by name"
        />
        {query && (
          <button type="button" className="ios-search-btn" aria-label="Clear search" onClick={() => setQuery("")}>
            <Icon name="clear" size={18} />
          </button>
        )}
      </div>

      {term === "" ? (
        children
      ) : searching ? (
        <div className="ios-skel" aria-hidden style={{ height: 120, margin: "16px 16px 0" }} />
      ) : failed ? (
        <MessageCard alert title="Couldn’t Search Players" body="Check your connection and try again." action={<TryAgain onClick={retry} />} />
      ) : results.length > 0 ? (
        <div className="ios-list" style={{ marginTop: 16 }}>
          {results.map((person) => (
            <PlayerRow key={person.id} person={person} />
          ))}
        </div>
      ) : searched ? (
        <MessageCard title="No Players Found" body={`Nobody called “${term}”. Try part of a name, or a different spelling.`} />
      ) : null}
    </>
  );
}
