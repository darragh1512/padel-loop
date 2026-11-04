"use client";

// One player's avatar. The rule:
//   1. If the player has uploaded a photo (avatar_url), show that.
//   2. Otherwise show a DiceBear avatar generated from their user id, so every
//      player gets a consistent, unique picture even before they upload one.
//   3. If an image ever fails to load, the Avatar falls back to their initials.
//
// DiceBear runs entirely in the browser (no network call): createAvatar builds
// an SVG from the seed, and toDataUri() turns it into an inline image source.

import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { thumbs } from "@dicebear/collection";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// Turn a name into up to two initials for the fallback (e.g. "Jonny K" → "JK").
function initialsFrom(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  const letters =
    (parts[0][0] ?? "") +
    (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? "");
  return letters.toUpperCase() || "P";
}

export default function PlayerAvatar({
  userId,
  avatarUrl,
  name,
  className,
}: {
  userId: string;
  avatarUrl?: string | null;
  name?: string | null;
  className?: string;
}) {
  // Generate the DiceBear fallback picture once per user id. DiceBear needs raw
  // hex, so these are soft versions of the redesign's teal and amber, plus a
  // cool mist, so generated avatars sit in-palette.
  const generated = useMemo(
    () =>
      createAvatar(thumbs, {
        seed: userId,
        backgroundColor: ["D5EAE6", "E4E9EC", "C9D6E3"],
        // Never amber: on the little court, amber means an open spot.
        shapeColor: ["0E6B65", "33566E", "4A5A57"],
      }).toDataUri(),
    [userId],
  );

  const src = avatarUrl || generated;

  return (
    <Avatar className={className}>
      <AvatarImage src={src} alt={name ?? "Player"} />
      <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
    </Avatar>
  );
}
