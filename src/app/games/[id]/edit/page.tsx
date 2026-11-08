"use client";
// Edit a game, in the same sheet as New Game. Only the game's creator can reach
// it (we check the logged-in user against the game's creator and send everyone
// else back to the game). The fields start with the game's current values.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CreateGameSheet, { type GameToEdit } from "@/components/CreateGameSheet";
import { getGame } from "@/lib/data";
import { getSignedInUser } from "@/lib/session";
import { utcToDublinInput } from "@/lib/time";
import { skillTierOf } from "@/lib/types";

export default function EditGamePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const gameId = params.id;
  const [editing, setEditing] = useState<GameToEdit | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await getSignedInUser();
      const uid = auth.user?.id ?? null;
      const game = await getGame(gameId);
      if (!active) return;
      if (!game || !uid || game.createdBy !== uid) {
        router.replace(`/games/${gameId}`);
        return;
      }
      const [date, time] = utcToDublinInput(game.startsAt).split("T");
      setEditing({
        gameId,
        venue: game.venue,
        area: game.area ?? "",
        date,
        time,
        level: skillTierOf(game),
        maxPlayers: game.maxPlayers,
        price: game.pricePerPlayer == null ? "" : String(game.pricePerPlayer),
        minutes: game.durationMins,
        court: game.courtNumber ?? "",
        players: game.players,
        guests: game.guestCount,
      });
    })();
    return () => {
      active = false;
    };
  }, [gameId, router]);

  return (
    <>
      <main className="ios" />
      {editing && <CreateGameSheet editing={editing} />}
    </>
  );
}
