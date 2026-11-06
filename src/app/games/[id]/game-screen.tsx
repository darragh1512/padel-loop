"use client";

// The game page: who, when, where, how much, and the one button that matters.
//
// The court in the header is the same court as on Home's next game: tapping that
// card grows it into this header. Joining settles your initials into the first
// open spot, at the same moment the count drops and the button changes.
//
// Only real data appears. Distance and drive time aren't stored yet, so they're
// left out. Court number and game length appear on games that have them.

import { addTransitionType, startTransition, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Court, { spotsFor } from "@/components/ios/Court";
import Icon, { type IconName } from "@/components/ios/Icon";
import { getProfile, type Profile } from "@/app/profiles";
import { initialsFrom } from "@/lib/data";
import { openDirections } from "@/lib/directions";
import { previousPath } from "@/lib/navMemory";
import {
  formatPrice,
  formatTimeRange,
  isCancelled,
  isFull,
  skillTierOf,
  tierOfPlayer,
  type Game,
  type Player,
} from "@/lib/types";
import { gameWhen, spotsOpenText } from "@/lib/when";
import type { WaitlistPlayer } from "../../games";
import { useCreatorActions, type MenuItem } from "./creator-actions";
import GameRoster from "./game-roster";
import { JoinBar, joinExplanation, useJoinControl } from "./join-game";
import LogResult from "./log-result";
import ShareGame, { copyGameLink } from "./share-game";
import WaitlistPanel from "./waitlist-panel";

function Fact({
  icon,
  title,
  sub,
  children,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="ios-row" style={{ padding: "9px 16px", minHeight: 58, "--ios-inset": "52px" } as React.CSSProperties}>
      <span className="ios-rico">
        <Icon name={icon} size={22} />
      </span>
      <div className="ios-grow">
        <div className="ios-bd">{title}</div>
        {sub && <div className="ios-fn ios-sec">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

// Sits outside the glass capsule that holds its button, because glass would
// otherwise trap the menu inside the capsule.
function MoreMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (
    <>
      <button type="button" className="ios-menu-scrim" aria-label="Close menu" tabIndex={-1} onClick={onClose} />
      <div
        className="ios-menu ios-game-menu"
        role="menu"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        {items.map((item, i) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            autoFocus={i === 0}
            className="ios-menu-item"
            style={{ paddingLeft: 14 }}
            data-destructive={item.destructive}
            onClick={() => {
              onClose();
              item.onPress();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

export default function GameScreen({
  game,
  queue,
  hasResult,
}: {
  game: Game;
  queue: WaitlistPlayer[];
  hasResult: boolean; // a match is being scored, so the players are fixed
}) {
  const router = useRouter();
  const full = isFull(game);
  const closed = game.isManuallyClosed === true;
  const cancelled = isCancelled(game);
  const price = formatPrice(game.pricePerPlayer);
  const when = gameWhen(game.startsAt);
  const place = game.area ? `${game.venue}, ${game.area}` : game.venue;

  const control = useJoinControl({ gameId: game.id, priced: price != null, full, manuallyClosed: closed });
  const { userId, joined, loading } = control;
  const isOrganiser = userId != null && userId === game.createdBy;

  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    getProfile(userId).then((p) => {
      if (active) setProfile(p);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  // The header sits under the status bar, so the phone's bars take its colour
  // while this page is open.
  useEffect(() => {
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const before = metas.map((m) => m.content);
    const surround = getComputedStyle(document.documentElement).getPropertyValue("--ios-court-surround").trim();
    metas.forEach((m) => {
      m.content = surround;
    });
    return () => metas.forEach((m, i) => {
      m.content = before[i];
    });
  }, []);

  // A joining or leaving player shows at once, ahead of the page's own re-read.
  const players: Player[] = useMemo(() => {
    if (loading || !userId) return game.players;
    const listed = game.players.some((p) => p.id === userId);
    if (joined && !listed) {
      const name = profile?.name ?? "You";
      return [
        ...game.players,
        { id: userId, name, initials: initialsFrom(profile?.name), level: 0, skill: profile?.skill_level ?? null, avatarUrl: profile?.avatar_url ?? null },
      ];
    }
    if (!joined && listed) return game.players.filter((p) => p.id !== userId);
    return game.players;
  }, [game.players, joined, loading, userId, profile]);

  const open = game.maxPlayers - players.length - game.guestCount;
  const status = closed ? "Closed" : open > 0 ? spotsOpenText(open) : "Full";

  const [menuOpen, setMenuOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);

  // A short note above the join bar: link copied, or something that went wrong.
  const [toast, setToast] = useState<string | null>(null);
  const [linkToCopy, setLinkToCopy] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  function showCopyResult(result: { copied: true } | { url: string }) {
    if ("url" in result) setLinkToCopy(result.url);
    else setToast("Link Copied");
  }

  const creator = useCreatorActions({
    gameId: game.id,
    recursWeekly: game.recursWeekly,
    seriesId: game.seriesId,
    isManuallyClosed: closed,
    onMessage: setToast,
  });

  const memberItems: MenuItem[] = joined || isOrganiser
    ? [{ label: "Game Chat", onPress: () => router.push(`/games/${game.id}/chat`) }]
    : [];
  const menuItems: MenuItem[] = [
    ...memberItems,
    { label: "Copy Link", onPress: () => copyGameLink(game.id).then(showCopyResult) },
    ...(isOrganiser && !cancelled ? creator.items : []),
    ...(joined && !isOrganiser && !cancelled
      ? [{ label: "Leave Game", destructive: true, onPress: () => control.setConfirmingLeave(true) }]
      : []),
  ];

  function goBack() {
    const previous = previousPath();
    if (previous === "/") {
      // Shrinks the court back into Home's card. The browser's own Back can't
      // run this animation, so this goes to Home directly.
      startTransition(() => {
        addTransitionType("close-game");
        router.push("/");
      });
    } else if (previous) {
      router.back();
    } else {
      router.push("/discover"); // arrived from a shared link: nothing to go back to
    }
  }

  const tier = skillTierOf(game);
  const viewerTier = tierOfPlayer(profile?.skill_level);
  const explanation = joinExplanation(control, { full, manuallyClosed: closed });
  const timeSub = [
    game.durationMins != null ? `${game.durationMins} minutes` : null,
    game.courtNumber ? `Court ${game.courtNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {menuOpen && (
        <MoreMenu
          items={menuItems}
          onClose={() => {
            setMenuOpen(false);
            moreButton.current?.focus();
          }}
        />
      )}

      <div className="ios-game-head">
        <div className="ios-game-tools">
          <button type="button" className="ios-gcap-i ios-glass-clear ios-press" aria-label="Back" onClick={goBack}>
            <Icon name="chevron-left" size={20} />
          </button>
          <div className="ios-gcap ios-glass-clear">
            {/* Anyone who can see the game can share it, signed in or not: a
                link that can't be passed on dead-ends the chain that brought
                this person here. */}
            <ShareGame gameId={game.id} venue={game.venue} when={when} onFallback={showCopyResult} />
            <button
              ref={moreButton}
              type="button"
              className="ios-gcap-i ios-press"
              aria-label="More"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="ellipsis" size={24} />
            </button>
          </div>
        </div>
        <ViewTransition name={`game-court-${game.id}`} share="court-morph" default="none">
          <div>
            <Court
              spots={spotsFor(players, game.maxPlayers, null, game.guestCount)}
              big
              radius={6}
              label={`Court with ${players.length + game.guestCount} of ${game.maxPlayers} spots taken, ${status}`}
            />
          </div>
        </ViewTransition>
      </div>

      <div style={{ padding: "16px 20px 12px" }}>
        <h1 className="ios-t1">{when}</h1>
        <div className="ios-hl" style={{ marginTop: 2 }}>
          {place}
        </div>
      </div>

      {explanation && (
        <div className="ios-card ios-sh ios-sec" style={{ padding: "12px 16px", marginBottom: 12 }}>
          {explanation}
        </div>
      )}

      <div className="ios-list">
        <Fact icon="clock" title={formatTimeRange(game)} sub={timeSub || undefined} />
        <Fact icon="pin" title={game.area ?? game.venue}>
          <button type="button" className="ios-pill-tint ios-press" onClick={() => openDirections(place)}>
            Directions
          </button>
        </Fact>
        <Fact icon="level" title={tier} sub={viewerTier === tier ? "Matches your level" : undefined} />
        {/* Shown ONLY when the organiser set a price. It's what one player pays,
            so no total is worked out from it. */}
        {price && <Fact icon="euro" title={`${price} per player`} sub="Split between the group" />}
        {game.recursWeekly && <Fact icon="repeat" title="Repeats Weekly" />}
      </div>

      <GameRoster
        gameId={game.id}
        players={players}
        guests={game.guestCount}
        maxPlayers={game.maxPlayers}
        viewerId={userId}
        createdBy={game.createdBy}
        locked={hasResult || cancelled}
      />

      <WaitlistPanel isOrganiser={isOrganiser} queue={queue} manuallyClosed={closed} />

      {(joined || isOrganiser) && (
        <div className="ios-list" style={{ marginTop: 18 }}>
          <Link
            href={`/games/${game.id}/chat`}
            className="ios-row ios-link"
            style={{ minHeight: 48, padding: "0 16px" }}
          >
            <span className="ios-rico">
              <Icon name="chat" size={22} />
            </span>
            <div className="ios-bd ios-grow">Game Chat</div>
            <span className="ios-chev">
              <Icon name="chevron-right" size={13} />
            </span>
          </Link>
        </div>
      )}

      {/* The organiser starts the match once the game is full, then every player
          enters the score separately. The server confirms it when they all match. */}
      <LogResult gameId={game.id} players={game.players} createdBy={game.createdBy} maxPlayers={game.maxPlayers} cancelled={cancelled} />

      <div style={{ height: 72 }} />

      <JoinBar
        control={control}
        status={status}
        statusIsOpen={!closed && open > 0}
        detail={[price, when].filter(Boolean).join(" · ")}
        isOrganiser={isOrganiser}
        cancelled={cancelled}
        full={full}
        manuallyClosed={closed}
        hasResult={hasResult}
      />

      {!control.error && toast && (
        <div className="ios-toast ios-glass ios-fn" role="status">
          {toast}
        </div>
      )}
      {linkToCopy && (
        <div className="ios-toast ios-glass" style={{ width: "min(100% - 32px, 416px)" }}>
          <input
            readOnly
            autoFocus
            value={linkToCopy}
            aria-label="Game link"
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => setLinkToCopy(null)}
            className="ios-fn"
            style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "inherit" }}
          />
        </div>
      )}

      {creator.alerts}
    </>
  );
}
